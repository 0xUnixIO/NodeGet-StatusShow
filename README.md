# NodeGet-StatusShow

一个服务器状态展示页

## 开发

```bash
npm i
npm run dev
```

# 部署

build 完是纯静态站 丢哪都行

## 一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/NodeSeekDev/NodeGet-StatusShow&env=SITE_1,SITE_NAME,SITE_LOGO,SITE_FOOTER&envDescription=站点信息和主控连接&envLink=https://github.com/NodeSeekDev/NodeGet-StatusShow%23环境变量)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/NodeSeekDev/NodeGet-StatusShow)

# 环境变量

> 环境变量是 **build 时** 注入的 改完之后必须重新部署一次才会生效 在面板里光改不重新跑 build 是没用的

```
SITE_NAME=狼牙的探针
SITE_LOGO=https://example.com/logo.png
SITE_FOOTER=Powered by NodeGet
SITE_1=name="master-1",backend_url="wss://m1.example.com",token="abc123"
SITE_2=name="master-2",backend_url="wss://m2.example.com",token="xyz789" 
```

前三个对应 `site_name` / `site_logo` / `footer` 不写就用默认值

`SITE_n` 是主控 值用 `key="value"` 拿逗号串起来 支持 `name` / `backend_url` / `token` 三个字段 值里要塞引号或反斜杠的话用 `\"` 和 `\\` 转义

从 `SITE_1` 开始连续往上数 中间断了就停 所以加新主控接着 `SITE_3` `SITE_4` 就行

一个 `SITE_n` 都没设的话脚本啥也不干 直接用仓库里那份 `config.json` 本地 `npm run dev` 走的是 vite 直接起 也不会触发这个脚本

可以只有一个 `SITE` 不强制 `SITE_2` `SITE_3` 之类的