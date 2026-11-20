import config from './backend/public-config.js';import{startAnalytics}from'./backend/tracker.js';
if(location.hostname==='eliabemartinsart.github.io'&&(location.pathname==='/'||location.pathname==='/index.html')){const start=()=>{try{startAnalytics(config)}catch{}};if(document.prerendering)document.addEventListener('prerenderingchange',start,{once:true});else start()}
