##### Command to create docker image: #####
docker build -t workdesk24-api .

###### Command to run docker image: ######
docker run -p 3000:3000 --env-file .env workdesk24-api

###### To deploy code, we need to use below commands #######
git push origin master / git push (To deploy on bitbucket)
git push github master (To deploy on github for deployment purpose on railway)

###### Railway commands #######
npm i -g @railway/cli (To install railway/cli from local)
railway login (To login railway account from cli on local)
railway connect
railway link (To link production railway project on local cli)
railway run npm start (To run railway production app from local)
railway run printenv (To print railway production app env variables on local)
railway logs (To check production app logs on local)