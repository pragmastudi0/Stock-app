# Publicar en GitHub: `pragmastudi0/Stock-app`

Desde esta carpeta no se pudo crear el remoto automáticamente (hace falta iniciar sesión en GitHub). Seguí uno de estos flujos.

## Opción A — GitHub web + Git en la terminal

1. Creá el repositorio vacío en GitHub: [github.com/new](https://github.com/new)  
   - **Owner:** `pragmastudi0`  
   - **Repository name:** `Stock-app`  
   - **Public**  
   - Sin README, sin .gitignore, sin licencia (el proyecto ya los trae).

2. En la carpeta del proyecto:

```bash
cd stock-app
git init
git add .
git commit -m "Initial commit: Stock app (Next.js + Supabase)"
git branch -M main
git remote add origin https://github.com/pragmastudi0/Stock-app.git
git push -u origin main
```

Si usás SSH:

```bash
git remote add origin git@github.com:pragmastudi0/Stock-app.git
git push -u origin main
```

## Opción B — GitHub CLI (`gh`)

```bash
gh auth login -h github.com
cd stock-app
git init
git add .
git commit -m "Initial commit: Stock app (Next.js + Supabase)"
gh repo create pragmastudi0/Stock-app --public --source=. --remote=origin --push
```

## Bundle (opcional)

Si tenés un archivo `stock-app.git-bundle`, podés reconstruir el repo con:

```bash
git clone stock-app.git-bundle Stock-app
cd Stock-app
# luego agregar remote y push como arriba
```
