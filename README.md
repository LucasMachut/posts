# Posts — application de planches Instagram

Le dossier `app/` est l'application complète. Elle remplace `generateur-posts.html`
(gardé ici avec son backup, mais plus mis à jour).

## Sur le PC

Double-clic sur `Posts (PC).html` : c'est toute l'application en un seul fichier, qui s'ouvre
directement dans Chrome. Il est fabriqué à partir de `app/` par :

    node app/build-pc.js

À relancer après chaque modification dans `app/`. Ne pas ouvrir `app/index.html` en double-clic :
Chrome refuse les modules JavaScript depuis un fichier local, la page reste vide. Pour tester
`app/` tel qu'il sera en ligne, `lancer-sur-pc.bat` le sert sur `http://localhost:8765/`.

## Sur l'iPhone

L'application est en ligne : **https://lucasmachut.github.io/posts/**

Dans Safari sur l'iPhone : ouvrir l'adresse, bouton Partager, « Sur l'écran d'accueil ».
L'icône « Posts » ouvre l'app en plein écran, et ça marche ensuite hors ligne.
Photos et planches restent sur le téléphone, rien ne part sur un serveur.
Ajouter les photos depuis l'icône, pas depuis Safari : les deux ont chacun leur stockage.

## Mettre à jour

Ce dossier est un dépôt git relié à `github.com/LucasMachut/posts`. Chaque push sur `main`
redéploie `app/` sur GitHub Pages en une minute environ (workflow `.github/workflows/pages.yml`).
L'app recharge d'elle-même la nouvelle version à l'ouverture suivante.

    git add -A
    git commit -m "ce qui change"
    git push

## Structure de `app/`

- `index.html`, `css/app.css` : la page et son style
- `js/main.js` : démarrage
- `js/ui.js` : barre du bas, panneaux (photo, texte, voile, planche, style, export), menu, générateur
- `js/render.js` : affichage des planches, gestes, placement du texte, halo
- `js/gestures.js` : tap, glisser, pincer, molette (pointer events)
- `js/photos.js` : banque de photos dans IndexedDB (aperçus + originaux)
- `js/export.js` : dessin canvas pleine résolution, partage natif, ZIP
- `js/generator.js` : « nouvelle proposition »
- `js/model.js`, `js/state.js` : modèle d'une planche, sauvegarde locale, migration des anciennes maquettes
- `js/geometry.js`, `js/veil.js`, `js/grain.js` : calculs partagés écran / export
- `manifest.webmanifest`, `sw.js`, `icons/` : installation et hors ligne

## Différences avec l'ancien générateur

- La taille du texte est celle que tu choisis : les vers trop longs passent à la ligne au lieu de
  rétrécir tout le texte. L'option « réduits pour tenir sur une ligne » redonne l'ancien comportement.
- Le texte s'édite dans le panneau « texte », plus directement sur la planche. Il se déplace au doigt.
- Alignement gauche / centre / droite dans le panneau « texte ».
- Une maquette `.json` de l'ancien générateur se recharge dans la nouvelle app (menu ⋯). Les photos
  sont à remettre depuis la banque, elles sont reconnues par leur nom de fichier.
- Projets : chaque album ou post a ses planches et sa propre banque de photos (nom en haut, ou menu ⋯ → projets).
  « Recharger une maquette » crée un nouveau projet au lieu d'écraser celui qui est ouvert.
  À la première ouverture, l'ancienne sauvegarde et l'ancienne banque deviennent « Projet 1 ».
