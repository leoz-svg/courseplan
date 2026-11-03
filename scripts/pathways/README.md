# 本地路径规划器

运行目录为项目根目录，依赖 Python 3.10+（当前本机使用 3.13）。首次配置：

```powershell
python -m venv .planner-venv
.\.planner-venv\Scripts\python.exe -m pip install -r scripts/planner-requirements.txt
npm run test:pathways
npm run build
npm run start -- --port 3010 --hostname 127.0.0.1
```

模型与求解器相互独立。路径计算使用 OR-Tools CP-SAT 9.14.6206；有兴趣描述时，服务端尝试复用 Ollama EmbeddingGemma 的语义相似度作为选修偏好，并保留词义匹配回退。没有 Ollama 仍可生成满足已录入规则的方案。聊天生成模型不决定先修资格或课程学分。

/api/pathways 启动此目录 solve.py，通过标准输入输出传 JSON，windowsHide 避免弹出窗口。默认解释器在项目 .planner-venv 中，可通过 COURSEPLAN_PLANNER_PYTHON 指定；单次求解进程最多 25 秒，每个优化目标每次搜索最多 2 秒。仅在本地 Node 服务中运行，不支持纯静态 GitHub Pages 托管。

规则包含：目标精确学分、已完成与认可学分去重、AND/OR、先修/共修、最低已修学分、互斥课程、每学期负载、开课政策、现有安排锁定、毕业草案的模块分配。不能自动判定的学术条件不会被当成已满足；专业准入等另行提示核实。历史开课假设会在结果中列出；严格模式不用缺失的开课资料。

设计 2024 规则有来源冲突：正文 108+24+12，结构化完成要求与独立模块页 108+18+18。目前以结构化模块构成显式草案，要求用户确认，不能作为学校批准的毕业路径。设计池 61 门是可选集合，并非全部需要修读。其他 Program 暂只支持阶段目标。

最多生成三个不同方案。按尽早结束、学分均衡、兴趣/选修组合排序；为后续方案添加差异约束，优先不同选修集合，必要时不同学期安排。不同候选的最优性只针对当次目标和约束；超时的可行解与已证最优解分开展示，不宣称列举全部方案。

输出后由独立 audit 重新计算先修时序、学分、模块、重复课程、互斥、开课和锁定；校验失败不返回方案。采用方案生成新 ID，保留原计划；planningMeta 存储规则版本、目标、认可映射和修改状态。手动修改后提示重新生成。

测试 fixture tests/fixtures/design-pathway-job.json 固定设计历史快照，14 项 Python 测试含真实设计路线、RPL、严格开课、先修/共修、锁定、互斥、独立复核和 IT 等价课去重。Node 领域测试另验证计划导入、metadata 和原有功能。

2026-11-03扩充：IT65门、商科52门、设计61门；三专业的144CP阶段方案均有真实API复核。IT/商科仍未启用正式毕业模块。数据抓取/导入脚本分别为scripts/fetch-expanded-programs.py和scripts/import-expanded-programs.py；原始模块、科目证据在app/data/catalog/expanded-program-pools.json和expanded-program-evidence.json。专业范围的最低学分解释绑定源文摘要，主修模块范围无法判定的条件保留manual。npm run test:pathways通过node runner调用本地解释器，兼容Windows路径；共22项Python测试。
