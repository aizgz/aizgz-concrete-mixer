# AIZGZ Machinery Website

AIZGZ Machinery 官网代码仓库。项目由静态 HTML、Vercel Serverless Functions 和 Decap CMS 组成；产品详情页、首页产品卡片和 sitemap 在构建时生成。

## 环境要求

- Node.js 22、23 或 24（不自动升级到下一个主版本）
- npm 10 或更高版本
- Python 3.12（用于图片处理与测试）

## 安装与构建

```bash
npm ci
python -m pip install -r requirements.txt
npm run build
```

`npm run build` 会生成 Tailwind CSS、产品详情页，并更新首页产品卡片和 `sitemap.xml`。产品详情页输出到 `products/`、`es/products/`、`ar/products/` 和 `ru/products/`；这些目录属于构建产物，不需要提交到 Git。

## 测试

```bash
python -m unittest discover -s scripts -p 'test_*.py' -v
```

GitHub Actions 会在 Pull Request 和 `main` 分支更新时安装锁定的 npm 依赖、执行网站构建、检查已提交的 Tailwind CSS，并运行图片处理单元测试。

## CMS 内容

后台入口：`/admin/`。Decap CMS 配置位于 `admin/config.yml`：

- 产品：`content/products/`
- 发货与案例：`content/cases/`
- 视频展厅：`content/videos/`
- 全局设置：`content/settings/general.json`
- 上传媒体：`uploads/`

CMS 使用 GitHub 后端，将内容提交到 `main` 分支；提交会触发 Vercel 生产构建。OAuth 密钥等凭据必须保存在 Vercel 环境变量中，不要提交到仓库。

## 图片处理

原始上传图片保留在 `uploads/`。`scripts/convert_images.py` 为 JPEG/PNG 生成 400px、800px 和原尺寸 WebP 版本。Pillow 版本由 `requirements.txt` 固定；图片工作流会先运行测试，再生成或清理 WebP 变体。

手动处理图片：

```bash
python -m pip install -r requirements.txt
python -m unittest discover -s scripts -p 'test_*.py' -v
python scripts/convert_images.py
```

## 部署

GitHub `main` 分支连接 Vercel 生产环境；Pull Request 预览部署用于验收。`vercel.json` 中的 `outputDirectory: "."` 是当前静态站点和 API 结构所需配置，不应随意更改。
