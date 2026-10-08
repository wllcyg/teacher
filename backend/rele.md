# 🚀 教师工作台 & AI 极客早报 - 生产环境发版手册

这份手册旨在确保我们在本地完美跑通的**“全自动早报引擎 (DeepSeek V2.5 + QQ 邮箱推送)”**能够安全、平滑地着陆到您的云端生产服务器。

严格按照以下步骤操作，确保数据 **0 丢失**，服务 **0 故障**。

---

## 阶段一：本地电脑收尾 (下班前)

### 1. 确保所有改动已提交并 Push
在您的 Windows 本地终端 (`d:\self\teacher\backend`) 执行：
```bash
# 查看状态，确认没有遗漏的文件
git status

# 提交今天的所有重磅更新
git add .
git commit -m "feat: 增加基于 DeepSeek 的全自动 AI 极客早报模块及邮件推送，并修复 Git 数据覆盖隐患"

# 推送到远程仓库
git push origin main
```

---

## 阶段二：云端服务器部署 (晚上)

### 1. 登录服务器与数据安全备份
通过 SSH 登录您的 Ubuntu 云端服务器。为了防患于未然，在发版前先强制做一次数据库邮件备份。
```bash
# 强制触发一次原有的备份脚本，将数据库发到您的 QQ 邮箱
docker exec teacher_backend python scripts/backup_to_email.py
```
> [!TIP]
> 备份完成后，看一眼手机，确保收到了带数据库附件的邮件。

### 2. 拉取最新代码
进入线上的项目目录，把最新的代码拉下来：
```bash
cd /data/teacher/backend
git pull origin main
```

### 3. 配置核心环境变量 (必须手动完成)
因为我们在代码里加入了 `.env` 的安全屏蔽，这些密码没有传上服务器，所以您需要**在服务器本地补齐它们**。
```bash
# 用编辑器打开或创建 .env 文件
nano .env
```
将以下配置粘贴进去，按 `Ctrl+O` 存盘，`Ctrl+X` 退出：
```env
LLM_API_KEY=sk-ad24a7c6dbbc49728598a264809cfcc8
LLM_BASE_URL=https://api.deepseek.com/v1

# QQ 邮箱推送配置
BACKUP_EMAIL_USER=904039807@qq.com
BACKUP_EMAIL_PASS=gmbyzyprtsrzbbej
```

### 4. 重新封铸镜像 (包含全新核心模块)
因为我们新增了整整一个目录的 `rss_pipeline` 以及爬虫所依赖的包，必须重新 `docker build` 将它们压入系统环境。
```bash
# 重新打包镜像 (会读取最新的代码和依赖)
docker build -t teacher_backend_image:latest .
```

### 5. 卸载旧引擎，启动新引擎
**请完整复制并一次性执行以下命令**，它将关停旧服务，并立刻挂载上外置的硬盘数据拉起新服务。
```bash
# 1. 停机并销毁老容器
docker stop teacher_backend
docker rm teacher_backend

# 2. 满血复活！(注意必须挂载 .env 文件和宿主机的挂载目录)
docker run -d --name teacher_backend \
  -p 8001:8001 \
  --env-file .env \
  -v /data/teacher/backend/app:/app/app \
  -v /data/teacher/backend_data:/app/data \
  teacher_backend_image:latest
```

---

## 阶段三：验收与测试

### 1. 查看服务健康状态
```bash
docker ps
```
确保 `teacher_backend` 处于 `Up` 状态。

### 2. 人工触发一次自动化早报！
您可以直接在服务器上，调用我们下午埋在 FastAPI 里的“秘密接口”，看看整个链路是否打通：
```bash
curl -X POST http://127.0.0.1:8001/api/rss/trigger
```
> [!NOTE]
> 接口会立刻返回：`{"message":"RSS 早报流水线已在后台触发..."}`。
> 此时您可以输入 `docker logs -f teacher_backend` 查看后台打印的抓取日志。
> 大约 2 分钟后，您的手机 QQ 邮箱应该会响起提示音——新的一篇排版精美的早报推送成功了！

### 3. 放下手机，安心睡觉
由于我们在生命周期里注入了守护协程 `rss_daily_scheduler()`，明天早上 6:30，系统将自动进行下一次无人值守的新闻采编与发文。

**祝发版顺利，无 Bug 不加班！**
