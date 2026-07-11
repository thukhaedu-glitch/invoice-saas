import{db}from'../firebase'
import{doc,setDoc}from'firebase/firestore'

export const verificationId=(companyId,securityCode)=>`${companyId}_${securityCode}`

const clean=value=>{
if(value===undefined)return null
if(Array.isArray(value))return value.map(clean)
if(value&&typeof value==='object'){
if(typeof value.toDate==='function')return value.toDate().toISOString()
return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>[k,clean(v)]))
}
return value
}

export async function publishVerification(companyId,companyName,source,type){
if(!companyId||!source?.securityCode)return
const data={
companyId,
companyName:companyName||'',
documentType:type,
securityCode:source.securityCode,
status:source.status||'pending',
clientName:source.clientName||'',
date:source.date||source.startDate||null,
startDate:source.startDate||null,
endDate:source.endDate||null,
invoiceNumber:source.invoiceNumber||null,
quotationNumber:source.quotationNumber||null,
contractNumber:source.contractNumber||null,
items:clean(source.items||[]),
discount:Number(source.discount||0),
taxRate:Number(source.taxRate||0),
totalAmount:Number(source.totalAmount||0),
value:Number(source.value||0),
updatedAt:new Date().toISOString(),
}
await setDoc(doc(db,'publicVerifications',verificationId(companyId,source.securityCode)),data,{merge:true})
}

export function syncPublicVerifications(companyId,companyName,documents,type){
return Promise.allSettled(documents.map(item=>publishVerification(companyId,companyName,item,type)))
}
