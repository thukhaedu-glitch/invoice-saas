import{useEffect}from'react'
import{db}from'../firebase'
import{collection,getDocs,addDoc,serverTimestamp}from'firebase/firestore'

export function useRecurring(companyId){
useEffect(()=>{
if(!companyId)return
const generate=async()=>{
try{
const snap=await getDocs(collection(db,'companies',companyId,'invoices'))
const recurringInvs=snap.docs.map(d=>({id:d.id,...d.data()})).filter(i=>i.recurring)
const now=new Date()

for(const inv of recurringInvs){
if(inv.recurringEndDate&&new Date(inv.recurringEndDate)<now)continue
const lastDate=new Date(inv.lastRecurringDate||inv.date||now)
let shouldGenerate=false
let nextDate=new Date(lastDate)

if(inv.recurringInterval==='weekly'){
nextDate.setDate(nextDate.getDate()+7)
}else if(inv.recurringInterval==='monthly'){
nextDate.setMonth(nextDate.getMonth()+1)
}else if(inv.recurringInterval==='quarterly'){
nextDate.setMonth(nextDate.getMonth()+3)
}else if(inv.recurringInterval==='yearly'){
nextDate.setFullYear(nextDate.getFullYear()+1)
}

if(nextDate<=now)shouldGenerate=true

if(shouldGenerate){
const{id:_,invoiceNumber,lastRecurringDate,...data}=inv
const newDate=nextDate.toISOString().split('T')[0]
await addDoc(collection(db,'companies',companyId,'invoices'),{
...data,
invoiceNumber:'INV-'+Date.now().toString().slice(-6),
date:newDate,
status:'pending',
payments:[],
paidAmount:0,
remainingAmount:data.totalAmount,
securityCode:'SEC-'+Math.random().toString(36).substring(2,8).toUpperCase(),
createdAt:serverTimestamp(),
isRecurringCopy:true,
parentInvoiceId:inv.id,
lastRecurringDate:newDate,
})
}
}
}catch(e){console.error(e)}
}
generate()
},[companyId])
}
