const tlv=(id:string,value:string)=>`${id}${String(value.length).padStart(2,'0')}${value}`;
const clean=(v:string,max:number)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9 ]/g,'').toUpperCase().slice(0,max);
function crc16(payload:string){let crc=0xffff;for(let i=0;i<payload.length;i++){crc^=payload.charCodeAt(i)<<8;for(let j=0;j<8;j++)crc=(crc&0x8000)?((crc<<1)^0x1021)&0xffff:(crc<<1)&0xffff;}return crc.toString(16).toUpperCase().padStart(4,'0');}
export function buildPixPayload({key,name,city,amount,txid='VITRIO'}:{key:string;name:string;city:string;amount:number;txid?:string}){
 const merchant=tlv('00','BR.GOV.BCB.PIX')+tlv('01',key.trim());
 let payload=tlv('00','01')+tlv('26',merchant)+tlv('52','0000')+tlv('53','986');
 if(amount>0)payload+=tlv('54',amount.toFixed(2));
 payload+=tlv('58','BR')+tlv('59',clean(name||'VITRIO',25))+tlv('60',clean(city||'QUIXERAMOBIM',15))+tlv('62',tlv('05',clean(txid,25)||'***'))+'6304';
 return payload+crc16(payload);
}
