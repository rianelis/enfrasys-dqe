# DQE Deployment Notes

## Local Production Smoke Test

```powershell
npm install
npm run build
npm start
```

Open `http://127.0.0.1:4100/`. The Express server serves the built React app and API from the same port.

## Docker

```powershell
docker build -t enfrasys-dqe .
docker run --rm -p 4100:4100 -v ${PWD}/server/data:/app/server/data enfrasys-dqe
```

## Cloud Options

- Fast prototype: deploy the container to Render, Railway, Azure Container Apps, or Fly.io.
- Production database: use PostgreSQL through `DATABASE_URL`.
- Local development can still use SQLite automatically when `DATABASE_URL` is not set.

## Current Azure Deployment

- Resource group: `rg-enfrasys-dqe`
- Region: `southeastasia`
- Container app: `enfrasys-dqe`
- Container registry: `cab2257a59daacr.azurecr.io`
- Database: Azure Database for PostgreSQL Flexible Server
- Public URL: `https://enfrasys-dqe.politecliff-7166fcf2.southeastasia.azurecontainerapps.io/`

Redeploy the current local code:

```powershell
az acr build --registry cab2257a59daacr --resource-group rg-enfrasys-dqe --image enfrasys-dqe:latest .
az containerapp update --name enfrasys-dqe --resource-group rg-enfrasys-dqe --image cab2257a59daacr.azurecr.io/enfrasys-dqe:latest
```

Delete the Azure demo resources:

```powershell
az group delete --name rg-enfrasys-dqe
```

## Production Database

Local development uses SQLite automatically.

For PostgreSQL, Supabase, or Azure Database for PostgreSQL, set `DATABASE_URL`:

```powershell
$env:DATABASE_URL="postgresql://user:password@host:5432/database"
npm start
```

If your provider requires SSL:

```powershell
$env:PGSSL="true"
```

The API creates the `assessments` table and indexes on startup.
It also creates `app_settings` for server-side admin configuration.

## Optional AI Recommendations

Set these environment variables on the Container App to enable AI-assisted recommendations:

```powershell
az containerapp secret set --name enfrasys-dqe --resource-group rg-enfrasys-dqe --secrets openai-api-key=<your-key>
az containerapp update --name enfrasys-dqe --resource-group rg-enfrasys-dqe --set-env-vars OPENAI_API_KEY=secretref:openai-api-key OPENAI_MODEL=gpt-5.2
```

Without `OPENAI_API_KEY`, DQE uses its deterministic recommendation fallback.
