import urllib.request
import urllib.parse
import json
import sqlite3
import concurrent.futures
import time

BASE_URL = "http://127.0.0.1:8002/api"
DB_PATH = "/Users/moliang/Desktop/coder/teacher/backend/app/data/teacher_workbench.db"

def http_req(url, method="GET", data=None):
    req_data = None
    headers = {"Content-Type": "application/json"} if data is not None else {}
    if data is not None:
        req_data = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        body = resp.read().decode("utf-8")
        return resp.status, json.loads(body) if body else {}

def test_sqlite_pragmas():
    print("\n--- 1. Testing SQLite PRAGMAs ---")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("PRAGMA journal_mode;")
    jm = cursor.fetchone()[0]
    print(f"journal_mode: {jm}")
    assert jm.lower() == "wal", f"Expected WAL mode, got {jm}"

    cursor.execute("PRAGMA synchronous;")
    sync = cursor.fetchone()[0]
    print(f"synchronous: {sync} (1=NORMAL, 2=FULL)")
    
    conn.close()
    print("✓ SQLite PRAGMAs verified successfully!")

def test_batch_create_and_delete_duties():
    print("\n--- 2. Testing Batch Create & Delete for Duties (Seating) ---")
    test_duties = [
        {"岗位": "1排1列", "学生": "测试学生A", "类型": "座位", "时间": "测试班级", "备注": "测试"},
        {"岗位": "1排2列", "学生": "测试学生B", "类型": "座位", "时间": "测试班级", "备注": "测试"},
        {"岗位": "1排3列", "学生": "测试学生C", "类型": "座位", "时间": "测试班级", "备注": "测试"},
    ]
    
    # 1. Batch Create
    status, data = http_req(f"{BASE_URL}/tables/duties/batch-create", method="POST", data={"rows": test_duties})
    assert status == 200, f"batch-create failed: {data}"
    print(f"Batch create response: {data}")
    assert data.get("ok") is True and data.get("created") == 3

    # 2. Query created rows
    q = urllib.parse.urlencode({"时间": "测试班级"})
    status, rows = http_req(f"{BASE_URL}/tables/duties?{q}")
    assert status == 200
    ids = [r["id"] for r in rows if r.get("学生") in ["测试学生A", "测试学生B", "测试学生C"]]
    print(f"Found created IDs: {ids}")
    assert len(ids) == 3

    # 3. Batch Delete
    status, del_data = http_req(f"{BASE_URL}/tables/duties/batch-delete", method="POST", data={"ids": ids})
    assert status == 200, f"batch-delete failed: {del_data}"
    print(f"Batch delete response: {del_data}")
    assert del_data.get("ok") is True and del_data.get("deleted") == 3

    # 4. Verify cleanup
    status, rows = http_req(f"{BASE_URL}/tables/duties?{q}")
    remaining = [r["id"] for r in rows if r.get("学生") in ["测试学生A", "测试学生B", "测试学生C"]]
    assert len(remaining) == 0
    print("✓ Duties batch-create and batch-delete verified successfully!")

def test_attendance_batch_flow():
    print("\n--- 3. Testing Attendance Batch Flow ---")
    date_str = "2026-09-04"
    test_attendance = [
        {"日期": date_str, "学生": "测试考勤1", "状态": "迟到", "备注": "测"},
        {"日期": date_str, "学生": "测试考勤2", "状态": "请假", "备注": "测"},
    ]
    # Batch create
    status, data = http_req(f"{BASE_URL}/tables/attendance/batch-create", method="POST", data={"rows": test_attendance})
    assert status == 200
    assert data.get("created") == 2

    # Query
    q = urllib.parse.urlencode({"日期": date_str})
    status, rows = http_req(f"{BASE_URL}/tables/attendance?{q}")
    rows = [r for r in rows if r.get("学生") in ["测试考勤1", "测试考勤2"]]
    ids = [r["id"] for r in rows]
    assert len(ids) == 2

    # Batch delete
    status, data = http_req(f"{BASE_URL}/tables/attendance/batch-delete", method="POST", data={"ids": ids})
    assert status == 200
    assert data.get("deleted") == 2
    print("✓ Attendance batch flow verified successfully!")

def test_academic_batch_upsert():
    print("\n--- 4. Testing Academic Batch Upsert ---")
    upsert_payload = {
        "班级": "测试班级",
        "项目": "测试过关项",
        "日期": "2026-09-04",
        "records": [
            {"学生": "测试生1", "结果": "过关", "状态": "过关", "备注": ""},
            {"学生": "测试生2", "结果": "过关", "状态": "过关", "备注": ""},
            {"学生": "测试生3", "结果": "过关", "状态": "过关", "备注": ""},
        ]
    }
    status, data = http_req(f"{BASE_URL}/academic/batch-upsert", method="POST", data=upsert_payload)
    assert status == 200, f"batch-upsert failed: {data}"
    print(f"Batch upsert response: {data}")
    assert data.get("ok") is True and data.get("总录入") == 3

    # Clean up created academic rows
    q = urllib.parse.urlencode({"班级": "测试班级", "项目": "测试过关项"})
    status, rows = http_req(f"{BASE_URL}/tables/academic?{q}")
    ids = [r["id"] for r in rows if r.get("学生") in ["测试生1", "测试生2", "测试生3"]]
    if ids:
        status, del_data = http_req(f"{BASE_URL}/tables/academic/batch-delete", method="POST", data={"ids": ids})
        assert status == 200
        print(f"Cleaned up {len(ids)} academic test records")

    # Clean up test item
    q_item = urllib.parse.urlencode({"项目名": "测试过关项"})
    status, item_rows = http_req(f"{BASE_URL}/tables/items?{q_item}")
    for item in item_rows:
        http_req(f"{BASE_URL}/tables/items/{item['id']}", method="DELETE")
    print("✓ Academic batch-upsert verified successfully!")

def test_high_concurrency_writes():
    print("\n--- 5. Testing High-Concurrency Writes (WAL mode stress test) ---")
    def write_worker(worker_id):
        rows = [{"岗位": f"并发{worker_id}_{i}", "学生": f"并发生{worker_id}_{i}", "类型": "测试", "时间": "并发班", "备注": ""} for i in range(5)]
        status, data = http_req(f"{BASE_URL}/tables/duties/batch-create", method="POST", data={"rows": rows})
        return status == 200

    start_time = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(write_worker, i) for i in range(10)]
        results = [f.result() for f in futures]
    duration = time.time() - start_time
    print(f"Executed 10 concurrent batch writes (50 rows total) in {duration:.2f}s")
    assert all(results), "Some concurrent requests failed!"
    
    # Cleanup concurrent rows
    q = urllib.parse.urlencode({"时间": "并发班"})
    status, rows = http_req(f"{BASE_URL}/tables/duties?{q}")
    ids = [r["id"] for r in rows]
    if ids:
        http_req(f"{BASE_URL}/tables/duties/batch-delete", method="POST", data={"ids": ids})
        print(f"Cleaned up {len(ids)} concurrent test rows")
    print("✓ High-concurrency test passed with 0 database lock errors!")

if __name__ == "__main__":
    test_sqlite_pragmas()
    test_batch_create_and_delete_duties()
    test_attendance_batch_flow()
    test_academic_batch_upsert()
    test_high_concurrency_writes()
    print("\n==========================================")
    print("🎉 ALL OPTIMIZATIONS TESTED & VERIFIED OK!")
    print("==========================================")
