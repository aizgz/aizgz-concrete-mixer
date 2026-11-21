# AIZGZ Machinery Website

AIZGZ Machinery 的企业网站。项目采用静态 HTML、Vercel Serverless Functions 和 Decap CMS；产品详情页、首页产品卡片及 sitemap 在构建时生成。

## 环境要求

- Node.js 22.x（建议使用与 Vercel 一致的版本）
- npm 10.x
- Python 3.12

## 本地安装与构建

```bash
npm ci
python -m pip install -r requirements.txt
npm run build
```

`npm run build` 会依次：

1. 使用 Tailwind CSS 生成 `assets/tailwind.min.css`。
2. 读取 `content/products/*.md`，生成英文、西班牙语、阿拉伯语和俄语产品详情页（仅生成具有对应翻译内容的语言页面）。
3. 更新首页产品卡片和 `sitemap.xml`。

产品详情页输出到 `products/`、`es/products/`、`ar/products/` 和 `ru/products/`，这些目录是构建产物，不需要提交到 Git。

## 测试

```bash
python -m unittest discover -s scripts -p 'test_*.py' -v
```

GitHub Actions 的 Build and test 工作流会在 Pull Request 和 `main` 分支更新时执行依赖安装、完整构建、Tailwind CSS 产物一致性检查及图片处理单元测试。

## 内容管理（Decap CMS）

后台地址：`/admin/`。集合配置位于 `admin/config.yml`：

- 产品：`content/products/`
- 发货与案例：`content/cases/`
- 视频展厅：`content/videos/`
- 全局设置：`content/settings/general.json`
- 上传媒体：`uploads/`

CMS 使用 GitHub 后端，将内容提交到 `main` 分支；提交会触发 Vercel 生产架��q�^