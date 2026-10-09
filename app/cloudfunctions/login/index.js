const cloud = require("wx-server-sdk");
const https = require("https");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const ENV_ID = process.env.TCB_ENV || "teacher-d4g74wc9be2d5b1f5";
const API_KEY = process.env.CLOUDBASE_API_KEY || "eyJhbGciOiJSUzI1NiIsImtpZCI6IjViZjk5YWQ5LTdlYzQtNDc0MS05ZmY2LWIxZTljM2Y2Zjg5NSJ9.eyJhdWQiOiJ0ZWFjaGVyLWQ0Zzc0d2M5YmUyZDViMWY1IiwiZXhwIjoyNTM0MDIzMDA3OTksImlhdCI6MTc5MTUyNDYxMCwiYXRfaGFzaCI6IkpTTmdrYUlQUWNleWdWMDZiZ0hxN2ciLCJwcm9qZWN0X2lkIjoidGVhY2hlci1kNGc3NHdjOWJlMmQ1YjFmNSIsIm1ldGEiOnsicGxhdGZvcm0iOiJBcGlLZXkifSwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImFwaWtleSIsInByb3ZpZGVycyI6WyJhcGlrZXkiXX0sImFkbWluaXN0cmF0b3JfaWQiOiIyMDk4MjM4MDI4MTE0ODI1MjE2IiwidXNlcl90eXBlIjoiIiwiY2xpZW50X3R5cGUiOiJjbGllbnRfc2VydmVyIiwiaXNfc3lzdGVtX2FkbWluIjp0cnVlfQ.L4Xrsg0yg-D9HxWodSWhAizVhQ3t26CSh_1DFmCOgBfsFVdMOg4-wJv70LXZF9yG88778Wvz8Co80oZgWPAwSCA_QzuiLHKhx42UBWMNT9vR6Mz4Jom2mYdRc4mNmnRrzvZdfqnVmsHsoRoviNVs8KaP906TfncfOaRS55IPh7U9iXzNbY_yrU2_XoPm6Ejr_nBLvA2AsGEdOShT18X9nwsuMtT9RjibVGOFoxMFqetvywmWR-8HAQjBoMEHavoshIMZ_Hmy4U9gh47fIH44NiJB5-mjLpf-bjAsfsRTqt8zehcgPPbfOOrMNTFHd6xb47S95E70Ta8eJatQrXT61Q";

function rdbRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = data ? JSON.parse(data) : null;
          resolve({ statusCode: res.statusCode, data: parsed, raw: data });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data, raw: data });
        }
      });
    });
    req.on("error", reject);
    if (body) {
      req.write(typeof body === "string" ? body : JSON.stringify(body));
    }
    req.end();
  });
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { success: false, error: "未获取到用户 OPENID" };
  }

  const envMode = event.envMode || "test";
  const tableName = envMode === "prod" ? "prod_users" : "test_users";
  const { action, userInfo } = event;

  try {
    if (action === "update") {
      const payload = {
        _id: openid,
        nickName: userInfo.nickName,
        avatarUrl: userInfo.avatarUrl,
        updateTime: new Date().toISOString()
      };

      const res = await rdbRequest(
        {
          hostname: `${ENV_ID}.api.tcloudbasegateway.com`,
          path: `/v1/rdb/rest/${tableName}`,
          method: "POST",
          headers: {
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=representation",
            Accept: "application/json"
          }
        },
        payload
      );

      if (res.statusCode >= 200 && res.statusCode < 300) {
        return { success: true };
      } else {
        console.error("PostgREST update failed:", res);
        return { success: false, error: res.raw || "更新数据库失败" };
      }
    } else {
      // 查询用户信息
      const queryRes = await rdbRequest({
        hostname: `${ENV_ID}.api.tcloudbasegateway.com`,
        path: `/v1/rdb/rest/${tableName}?_id=eq.${encodeURIComponent(openid)}`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          Accept: "application/json"
        }
      });

      if (queryRes.statusCode === 200 && Array.isArray(queryRes.data) && queryRes.data.length > 0) {
        const row = queryRes.data[0];
        return {
          success: true,
          openid,
          userInfo: {
            nickName: row.nickName || "读者",
            avatarUrl: row.avatarUrl || ""
          }
        };
      }

      // 未找到用户，初始化创建新记录
      const initUser = {
        _id: openid,
        nickName: "读者",
        avatarUrl: "",
        updateTime: new Date().toISOString()
      };

      await rdbRequest(
        {
          hostname: `${ENV_ID}.api.tcloudbasegateway.com`,
          path: `/v1/rdb/rest/${tableName}`,
          method: "POST",
          headers: {
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=representation",
            Accept: "application/json"
          }
        },
        initUser
      );

      return {
        success: true,
        openid,
        userInfo: { nickName: "读者", avatarUrl: "" }
      };
    }
  } catch (err) {
    console.error("login function error:", err);
    return { success: false, error: err.message };
  }
};
