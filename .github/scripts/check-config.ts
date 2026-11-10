for(const name of ['GROQCLOUD_API_KEY','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN']){
  if(!process.env[name]?.trim())throw new Error(`Missing Actions secret: ${name}`);
}
console.log('Required generation credentials are present.');
