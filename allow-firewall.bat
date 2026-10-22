@echo off
title KOUZ HOUS - Pare-feu (port 3000)
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Vous n'etes pas administrateur.
    echo     Faites un clic droit sur ce fichier puis "Executer en tant qu'administrateur".
    echo.
    pause
    exit /b 1
)

echo Ajout de la regle de pare-feu pour le port 3000 (KOUZ HOUS)...
netsh advfirewall firewall add rule name="KOUZ HOUS (Node.js port 3000)" dir=in action=allow protocol=TCP localport=3000 profile=any

if %errorlevel% equ 0 (
    echo.
    echo [OK] Regle ajoutee avec succes.
    echo      Vous pouvez maintenant ouvrir depuis votre iPhone :
    echo.
    echo      http://172.20.10.8:3000
) else (
    echo.
    echo [ERREUR] Impossible d'ajouter la regle. Verifiez vos droits administrateur.
)
echo.
pause
