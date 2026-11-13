# grabit-feed

Public repo. A GitHub Action fetches football highlights from ScoreBat every
6 hours and saves them to `highlights.json`, which the Grabit app reads.

Setup (once):
1. Create a **public** repo named `grabit-feed` and upload these files.
2. Repo Settings > Secrets and variables > Actions > New secret:
   name `SCOREBAT_TOKEN`, value = your ScoreBat **API token** (not the embed token).
3. Actions tab > "Update highlights" > Run workflow.
