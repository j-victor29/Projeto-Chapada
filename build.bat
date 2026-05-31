@echo off
cd /d "c:\Users\usuario\Downloads\Projeto-Chapada-main"
echo === Instalando dependencias ===
npm install
echo === Rodando build ===
npm run build
echo === FIM ===
pause
