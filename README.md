<p align="center">
  <img src="./icons/icon-192.png" alt="SBTI Logo" width="96" height="96" />
</p>

<h1 align="center">我的 SBTI 版本</h1>

<p align="center">
  一个可直接部署、可离线访问、支持结果导出的纯前端 SBTI 测试站。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Static%20Site-HTML%20%2B%20CSS%20%2B%20JS-1f6feb" alt="Static Site" />
  <img src="https://img.shields.io/badge/Build-No%20Build-2da44e" alt="No Build" />
  <img src="https://img.shields.io/badge/Cache-localStorage-8250df" alt="localStorage" />
  <img src="https://img.shields.io/badge/Result-PNG%20Export-d97706" alt="PNG Export" />
  <img src="https://img.shields.io/badge/PWA-Installable-0ea5e9" alt="PWA" />
  <img src="https://img.shields.io/badge/Deploy-GitHub%20Pages%20%2F%20Cloudflare%20Pages-111827" alt="Deploy Ready" />
</p>

<p align="center">
  保留原测试的题库、结果体系和整体玩法，补上更适合直接上线使用的前端能力。
</p>

<p align="center">
  <a href="#overview">项目简介</a> ·
  <a href="#features">核心能力</a> ·
  <a href="#quickstart">快速开始</a> ·
  <a href="#deploy">部署方式</a> ·
  <a href="#structure">项目结构</a> ·
  <a href="#boundary">使用边界</a>
</p>

---

<a id="overview"></a>

## 项目简介

> 不是给原项目再套一层静态页面，而是把它整理成一个能直接发布、能缓存进度、能导出结果图的纯前端版本。

这个版本基于原项目复刻并做了部署友好型增强，在不引入后端和构建流程的前提下，保留原有题库、结果体系和整体玩法，同时补上更适合上线使用的前端能力。

## 适合谁用

- 想快速上线一个轻量测试页的人
- 想部署到 GitHub Pages、Cloudflare Pages、Vercel 等静态平台的人
- 想保留纯前端结构，不接数据库和后端接口的人
- 想在原始题库和结果设定基础上继续扩展体验的人

<a id="features"></a>

## 核心能力

| 能力 | 说明 |
| --- | --- |
| 本地缓存恢复 | 自动保存答题进度和最终结果，刷新页面后仍可继续查看 |
| 一键导出结果图 | 结果页支持导出 PNG 长图，适合分享和保存 |
| 离线访问 | `service-worker.js` 会缓存核心静态资源，首次加载后可离线打开 |
| 安装到桌面 | 提供 `manifest.webmanifest`，支持添加到桌面或主屏幕 |
| 零构建部署 | 不需要安装依赖，不需要打包流程，发布仓库根目录即可 |
| 匿名结果上报 | 可选对接 `POST /api/result`，上报 `anonymousId`、`finalType`、`special`、`createdAt`、`version` |

## 现在保留了什么

- 原测试的主要题库与结果体系
- 原有人格结果图资源
- 纯静态页面的访问方式

## 现在增强了什么

- 浏览器本地缓存答题进度
- 浏览器本地缓存最终结果
- 可选匿名结果上报，用于统计人格分布占比
- 结果页长图导出
- PWA 安装与基础离线能力
- 更适合 GitHub 首页展示的项目文档结构

<a id="quickstart"></a>

## 快速开始

这是一个纯静态项目，不需要安装依赖。

### 方式一：本地静态服务预览

```bash
python3 -m http.server 4173
```

打开：

```text
http://127.0.0.1:4173
```

### 方式二：直接打开文件

也可以直接双击打开 `index.html`，但为了保证图片、缓存、PWA 和导出行为更稳定，仍然建议通过本地静态服务预览。

### 方式三：带统计接口一起运行

如果你要启用匿名结果统计，请直接运行仓库里的 Node 服务：

```bash
node server.js
```

默认地址：

```text
http://127.0.0.1:4173
```

这个服务会同时：

- 托管当前静态站点
- 接收 `POST /api/result`
- 提供 `GET /api/stats`
- 把去重后的最新结果存到 `data/result-latest.json`

需要改端口时可以这样启动：

```bash
PORT=8080 node server.js
```

<a id="deploy"></a>

## 部署方式

本项目没有构建步骤，部署时直接发布仓库根目录即可。

| 平台 | 配置建议 |
| --- | --- |
| GitHub Pages | 将仓库推送到 GitHub 后，在仓库设置中开启 Pages，发布源选择默认分支即可 |
| Cloudflare Pages | 导入当前仓库，构建命令留空，输出目录填写 `/` |
| Vercel | 作为普通静态站点导入即可，不需要额外构建配置 |
| 其他静态托管平台 | 只要支持直接托管 HTML、CSS、JS 和图片资源，通常都可以直接部署 |

如果你要启用 `POST /api/result` 统计功能，就不能只放在纯静态托管上了；需要跑一个支持后端接口的服务，或者把 `/api/result` 反向代理到你自己的服务器。

如果你是用 `rsync --delete` 之类的方式发布静态文件，生产环境建议把统计数据文件放到站点根目录之外，例如通过 `SBTI_DATA_FILE=/var/lib/sbti/result-latest.json` 这类路径单独存放，避免部署时误删线上统计。

<a id="structure"></a>

## 项目结构

```text
.
├── server.js               # 零依赖 Node 服务，提供静态托管和统计 API
├── stats.html              # 统计查看页，读取 /api/stats
├── index.html              # 主页面，包含样式、题库、结果映射和交互逻辑
├── image/                  # 各人格结果图资源
├── icons/                  # 站点图标与 PWA 图标
├── manifest.webmanifest    # Web App Manifest
├── service-worker.js       # 离线缓存逻辑
├── README.md               # 项目说明
└── .gitignore
```

<a id="boundary"></a>

## 使用边界

| 适合 | 不适合 |
| --- | --- |
| 个人娱乐项目 | 严肃心理评估 |
| 社交传播页 | 需要账号体系和云端存档的产品 |
| 低成本静态站点部署 | 强依赖服务端统计或风控的业务系统 |
| 无后端活动页或测试页 | 需要后台管理、多端同步或复杂权限体系的项目 |

## 注意事项

- 当前缓存基于浏览器本地存储，不同浏览器、不同设备或无痕模式之间不会同步
- 清除浏览器站点数据后，缓存进度和结果会一并消失
- 结果长图本质上是当前页面截图，效果会受浏览器环境影响
- 长图导出依赖运行时加载的 `html2canvas`，如果用户在首次访问时完全离线，导出功能可能不可用
- 若启用 `POST /api/result`，只有用户主动提交结果时才会上报；恢复本地缓存不会重复上报
- 当前统计口径是“每个 `anonymousId` 最近一次结果”，不是历史提交总次数
- `stats.html` 默认不带鉴权；如果你不想公开统计页，建议在 Nginx 或网关层做密码、IP 白名单或内网限制
- 如果后续需要接入 SEO、统计、分享卡片、自定义域名或更多交互逻辑，可以继续在此版本上扩展

## 统计接口

### `POST /api/result`

请求体：

```json
{
  "anonymousId": "3a9ef2d7-5e5d-4c4a-b5cf-efea77d765f4",
  "finalType": "SHIT",
  "special": false,
  "createdAt": "2026-04-10T08:00:00.000Z",
  "version": "sbti-web-v1"
}
```

行为：

- 以 `anonymousId` 为唯一键
- 同一个设备再次提交时，直接覆盖成最新结果
- 存储文件默认是 `data/result-latest.json`
- 生产环境建议把这个文件放到 Web 根目录之外，避免静态资源发布时被覆盖或删除

### `GET /api/stats`

返回去重后的聚合结果，示例：

```json
{
  "ok": true,
  "versionFilter": null,
  "totalUsers": 128,
  "normalUsers": 119,
  "specialUsers": 9,
  "typeCount": 17,
  "types": [
    { "finalType": "SHIT", "count": 21, "percentage": 16.41 },
    { "finalType": "CTRL", "count": 17, "percentage": 13.28 }
  ]
}
```

可选按版本过滤：

```text
/api/stats?version=sbti-web-v1
```

统计页：

```text
/stats.html
```

## 原作者与致谢

- 原作者：[B站@蛆肉儿串儿](https://www.bilibili.com/video/BV1LpDHByET6/)
- 原始项目仓库：[UnluckyNinja/SBTI-test](https://github.com/UnluckyNinja/SBTI-test?tab=readme-ov-file)
- 当前版本基于原项目进行复刻、整理和增强

原项目的表达风格、题库设计和结果设定均来自原作者。当前仓库主要是在原有内容基础上做前端整理、部署适配和使用体验增强。

## 免责声明

- 本项目仅供娱乐和前端学习使用
- 请勿将测试结果视为医学、心理学或其他专业结论
- 如需商业化使用，建议先充分确认原始内容授权与署名方式
