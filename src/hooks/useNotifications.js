import{useEffect}from'react'
import{db}from'../firebase'
import{collection,getDocs,addDoc,query,where,serverTimestamp}from'firebase/firestore'

export function useNotifications(companyId){
useEffect(()=>{
if(!companyId)return
const generate=async()=>{
try{
const now=new Date()
const[invSnap,conSnap,quoSnap]=await Promise.all([
getDocs(collection(db,'companies',companyId,'invoices')),
getDocs(collection(db,'companies',companyId,'contracts')),
getDocs(collection(db,'companies',companyId,'quotations')),
])

const notifications=[]

// Overdue invoices (pending > 7 days)
invSnap.docs.forEach(d=>{
const inv=d.data()
if(inv.status==='pending'&&inv.createdAt?.seconds){
const days=Math.floor((now-new Date(inv.createdAt.seconds*1000))/(1000*60*60*24))
if(days>7){
notifications.push({
type:'overdue',
title:`Overdue Invoice: ${inv.invoiceNumber}`,
message:`${inv.clientName} — ${Number(inv.totalAmount||0).toLocaleString()} Ks (${days} days overdue)`,
ref:d.id,read:false,createdAt:serverTimestamp()
})
}
}
})

// Expiring contracts (within 30 days)
conSnap.docs.forEach(d=>{
const con=d.data()
if(con.status==='active'&&con.endDate){
const daysLeft=Math.floor((new Date(con.endDate)-now)/(1000*60*60*24))
if(daysLeft>=0&&daysLeft<=30){
notifications.push({
type:'contract',
title:`Contract Expiring: ${con.contractNumber}`,
message:`${con.title} — expires in ${daysLeft} day${daysLeft!==1?'s':''}`,
ref:d.id,read:false,createdAt:serverTimestamp()
})
}
}
})

// Pending quotations > 14 days
quoSnap.docs.forEach(d=>{
const quo=d.data()
if(quo.status==='pending'&&quo.createdAt?.seconds){
const days=Math.floor((now-new Date(quo.createdAt.seconds*1000))/(1000*60*60*24))
if(days>14){
notifications.push({
type:'pending',
title:`Pending Quotation: ${quo.quotationNumber}`,
message:`${quo.clientName} — awaiting response for ${days} days`,
ref:d.id,read:false,createdAt:serverTimestamp()
})
}
}
})

// Add only if not duplicate (simple check)
const existingSnap=await getDocs(query(
collection(db,'companies',companyId,'notifications'),
where('read','==',false)
))
const existingRefs=new Set(existingSnap.docs.map(d=>d.data().ref))

for(const n of notifications){
if(!existingRefs.has(n.ref)){
await addDoc(collection(db,'companies',companyId,'notifications'),n)
}
}
}catch(e){console.error(e)}
}
generate()
},[companyId])
}
