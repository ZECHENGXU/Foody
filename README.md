# Foody Web MVP

一个面向中小型餐厅的菜品包装助手 Web MVP。

项目包含：

- `backend/`：FastAPI API，内置 SQLite、本地图片上传、JWT 风格鉴权、多 provider AI 接入层
- `frontend/`：React + TypeScript + Vite 单页应用

## 当前能力

- 演示账号登录
- 一个账号管理多个店铺（创建、删除）
- 多步骤店铺风格档案填写（支持单选/多选/自定义输入）
- 菜品创建、再次生成建议
- 支持无图和有图两种生成模式
- 结构化建议结果展示
- 菜品历史和版本记录查看
- AI provider 支持 `OpenAI`、`Anthropic`、`Gemini`
- 兼容任意 `OpenAI-compatible` 平台
- 未配置 key 或调用失败时可自动回退到 mock
- CORS 支持多端口 localhost 访问

## 项目结构

```text
foody/
├─ backend/
│  ├─ app/
│  │  ├─ api/
│  │  │  ├─ deps.py
│  │  │  └─ v1/routes.py
│  │  ├─ core/
│  │  │  ├─ config.py
│  │  │  ├─ database.py
│  │  │  └─ security.py
│  │  ├─ main.py
│  │  ├─ models.py
│  │  ├─ schemas.py
│  │  └─ services.py
│  ├─ uploads/
│  ├─ requirements.txt
│  └─ .env.example
├─ frontend/
│  ├─ src/
│  │  ├─ pages/
│  │  │  ├─ LoginPage.tsx
│  │  │  ├─ StoresPage.tsx
│  │  │  ├─ ProfilePage.tsx
│  │  │  ├─ DishesPage.tsx
│  │  │  ├─ DishDetailPage.tsx
│  │  │  └─ HistoryPage.tsx
│  │  ├─ services/api.ts
│  │  ├─ store/authStore.ts
│  │  ├─ types/api.ts
│  │  └─ styles.css
│  ├─ package.json
│  └─ vite.config.ts
└─ README.md
```

## 后端启动

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

后端会自动创建：

- `foody.db`
- 演示账号 `demo@example.com / demo123456`
- 本地上传目录 `backend/uploads/`

## 前端启动

```bash
cd frontend
npm install
npm run dev
```

默认访问地址：`http://localhost:5173`

## 店铺风格档案

档案填写采用多步骤表单，支持三种字段类型：

- **多选**：从预设选项中选择多项，支持自定义补充
- **单选**：选择一个预设选项，或选择"其他"并自定义输入
- **文本输入**：自由文本输入

AI 会根据档案内容生成风格关键词、摆盘方向、语气风格和整体风格摘要，用于后续菜品建议生成。

## AI 配置

`backend/.env` 支持以下模式：

### 1. 自动模式

```env
AI_PROVIDER=auto
```

自动按顺序选择：

1. `COMPATIBLE_*`
2. `OPENAI_*`
3. `ANTHROPIC_*`
4. `GEMINI_*`
5. `mock`

### 2. 原生 OpenAI

```env
AI_PROVIDER=openai
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4.1-mini
```

### 3. 原生 Anthropic

```env
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_key
ANTHROPIC_MODEL=claude-3-5-sonnet-latest
```

### 4. 原生 Gemini

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-2.5-flash
```

### 5. 任意 OpenAI-compatible 平台

```env
AI_PROVIDER=openai_compatible
COMPATIBLE_PROVIDER_NAME=DeepSeek
COMPATIBLE_API_KEY=your_key
COMPATIBLE_MODEL=deepseek-chat
COMPATIBLE_BASE_URL=https://api.deepseek.com/v1
COMPATIBLE_API_KEY_HEADER=Authorization
COMPATIBLE_API_KEY_PREFIX=Bearer
COMPATIBLE_EXTRA_HEADERS_JSON={}
COMPATIBLE_EXTRA_BODY_JSON={}
```

这类模式通常可覆盖很多主流平台，例如：

- OpenRouter
- Groq
- Together
- Fireworks
- DeepSeek
- Moonshot
- SiliconFlow
- 以及其他兼容 `/chat/completions` 的平台

如果某个平台要求额外 header 或 body 字段，可以通过：

- `COMPATIBLE_EXTRA_HEADERS_JSON`
- `COMPATIBLE_EXTRA_BODY_JSON`

来补充。

## 关于图片输入

- `OpenAI`、`Anthropic`、`Gemini` 原生模式支持把本地上传图片转为内联多模态输入
- `OpenAI-compatible` 模式也会尝试按常见兼容格式传图
- 如果某个平台的兼容实现不完全一致，失败时会根据 `AI_FALLBACK_TO_MOCK` 自动回退

## 主流程验证

1. 登录演示账号
2. 创建店铺
3. 填写多步骤风格档案或跳过
4. 新增菜品并生成建议
5. 查看结果
6. 在历史页或菜品详情页再次生成新版本

## 说明

- 当前系统默认保留 mock fallback，所以没有 key 也能演示完整流程
- 真正的 AI 接入逻辑集中在 `backend/app/services.py`
- 数据库使用 SQLite，MVP 阶段通过 `create_all` 初始化
