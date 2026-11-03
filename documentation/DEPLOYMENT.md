# 发布与部署

目标仓库为leoz-svg/courseplan，旧uts-course-planner保持原状。默认演示路径为/courseplan，最终站点地址为https://leoz-svg.github.io/courseplan/。只有实际部署成功并通过HTTP/页面验证后，才可称为上线。

## GitHub Pages

仓库Settings → Pages → Build and deployment → Source选择GitHub Actions。提交main后，pages.yml会执行依赖安装、Node/Python测试、ESLint、完整应用构建、静态导出、artifact上传和Pages部署。首次发布需要仓库管理员启用该Source；普通GITHUB_TOKEN不会自动取得启用Pages的管理权限。

线上是静态Guest演示：完整目录/图/手动学期/学分/本地保存/JSON导入导出/关键词推荐可用；不会请求本机账号、Python或Ollama。自动规划页提供本地运行说明。未设置公网模型密钥，也没有把用户数据上传到开发者的账号库。

## 静态构建

```powershell
npm ci
npm run build:pages
```

输出为.pages-build/out。脚本只向明确限定的.pages-build目录写入/清理构建副本；复制app时排除API，使用原node_modules的本机链接。不会重命名原始app/api目录或改动.local-data。本目录应忽略，不要把链接或依赖上传。

若更改仓库名，用NEXT_PUBLIC_BASE_PATH指定新basePath并更新README和相关仓库链接。不能把out/index.html直接用file协议打开；需要静态HTTP服务器并映射/courseplan路径。

## 完整服务端运行

按README安装Node、Python/OR-Tools和可选Ollama。账号数据库是本地SQLite，需要持久化备份；生成模型与向量模型由使用者自行下载。公网完整部署还需要独立服务器与推理资源，不属于GitHub Pages。

## 发布内容与排除

包含app/lib/public/scripts/tests、依赖锁文件、构建配置、工作流、资料来源、README和本开发日志。

排除.env.local、.local-data、.rag-index、.planner-venv、node_modules、.next、.pages-build、原始HTML抓取work目录、模型和运行日志。示例环境文件只含空云端配置与本机默认值。GitHub只接收整理后的公开源码与官方历史资料节选，不接收私人账号或会话。

原课程代码及UTS资料不因发布而改变权利归属，详情见开发日志。
