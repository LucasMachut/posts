@echo off
rem Lance l'application Posts sur le PC (elle a besoin d'un petit serveur local, python suffit).
cd /d "%~dp0app"
start "" /min python -m http.server 8765
timeout /t 1 >nul
start "" http://localhost:8765/
echo L'application tourne sur http://localhost:8765/ - ferme la fenetre reduite "python" pour l'arreter.
