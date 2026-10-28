# 离线网页

完整离线 HTML 约28 MB，随 [v24发行版压缩包](https://github.com/luoban25/between-fields/releases/latest) 提供。

下载ZIP并解压后，双击其中的 `delivery/田野之间-直接打开.html` 即可运行四幅作品，不需要联网或安装 Node.js。

从源码重新生成：

```sh
npm install
npm run build:offline
npm run check:offline
```

生成文件保存在此目录，已从 Git 源码跟踪中排除，以避免重复提交大型生成文件。
