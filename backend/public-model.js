export const SOURCE_LABELS=['Direto / não informado','Instagram','Google','Bing','WhatsApp','Facebook','YouTube','LinkedIn','TikTok','Outro site','Outro link de campanha'];
export const SECTION_IDS=['inicio','projetos','sobre','ferramentas','reconhecimentos','contato','competencias'];
export function safePublicUrl(value,image=false){if(typeof value!=='string'||value.length>1000)return false;if(image&&/^\.\/assets\/[A-Za-z0-9_./% -]+$/.test(value)&&!value.includes('..'))return true;return /^https:\/\/[A-Za-z0-9.-]+(?::[0-9]{1,5})?(?:[/?#][^\s<>\"]*)?$/.test(value)}
export function validateContent(c){
 if(!c||c.version!==1||!Array.isArray(c.projects)||c.projects.length>50||!c.site)throw Error('Conteúdo inválido.');
 const ids=new Set();
 for(const p of c.projects){if(!p||!/^[a-z0-9][a-z0-9-]{0,63}$/.test(p.id)||ids.has(p.id))throw Error('Cada projeto precisa de um identificador único.');ids.add(p.id);
 for(const[k,max,required]of[['title',160,true],['category',100,true],['year',30,false],['role',200,false],['function',500,false],['production',240,false],['description',3000,false],['alt',240,true],['linkLabel',80,true],['cardKicker',160,false],['cardCredit',240,false],['award',80,false]])if(typeof p[k]!=='string'||p[k].length>max||(required&&!p[k].trim())||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(p[k]))throw Error('Confira o campo '+k+' de '+(p.title||p.id)+'.');
 if(!['animacao','direcao edicao','editorial'].includes(p.group)||!safePublicUrl(p.image,true)||!safePublicUrl(p.link))throw Error('Confira categoria, imagem e link de '+p.title+'. Use links HTTPS.');
 if(typeof p.visible!=='boolean'||typeof p.featured!=='boolean'||typeof p.portrait!=='boolean'||(p.featured&&(p.group==='editorial'||p.portrait)))throw Error('Destaques aceitam apenas projetos audiovisuais horizontais.');
 }
 for(const k of['heroIntro','aboutDescription','contactDescription'])if(typeof c.site[k]!=='string'||c.site[k].length>1500)throw Error('Texto de apresentação inválido.');
 if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(c.site.email)||c.site.email.length>254||!/^\d{10,15}$/.test(c.site.whatsapp))throw Error('Confira o e-mail e o WhatsApp.');
 return c;
}
