import{useState,useEffect}from'react'
import{db}from'../firebase'
import{doc,getDoc}from'firebase/firestore'

// fallback — Firestore config/plans မရှိရင် ဒါ သုံး
const FALLBACK=[
{key:'free',label:'Free Trial',price:0,discount:0,documents:10,customers:25,members:2,features:{finance:false,reportBuilder:false,auditLog:false},featureList:['Core CRM modules','Draft invoices & quotes','Basic dashboards'],active:true,popular:false},
{key:'starter',label:'Starter',price:49900,discount:0,documents:100,customers:200,members:3,features:{finance:false,reportBuilder:false,auditLog:false},featureList:['Core CRM modules','Draft invoices & quotes','Basic dashboards','100 documents/mo','Standard support'],active:true,popular:false},
{key:'growth',label:'Growth',price:69900,discount:0,documents:500,customers:1000,members:10,features:{finance:true,reportBuilder:false,auditLog:false},featureList:['Full finance module','Bank auto-reconciliation','Journal entries logging','500 documents/mo','24/7 priority support'],active:true,popular:true},
{key:'business',label:'Business',price:89900,discount:0,documents:-1,customers:-1,members:-1,features:{finance:true,reportBuilder:true,auditLog:true},featureList:['Everything in Growth','Custom report builder','Granular role permissions','Multi-office audit logs','Dedicated account lead'],active:true,popular:false},
]
const FALLBACK_PAY=[
{id:'acc1',name:'KBZPay',number:'09-XXX-XXX-XXX',accountName:'Your Name',qrUrl:''},
]

export function normalizePlan(plan){
if(!plan)return'free'
return String(plan).toLowerCase()
}

// Firestore ကနေ plans ဖတ်တဲ့ hook
export function usePlans(){
const[plans,setPlans]=useState(FALLBACK)
const[paymentAccounts,setPaymentAccounts]=useState(FALLBACK_PAY)
const[loading,setLoading]=useState(true)

useEffect(()=>{
const load=async()=>{
try{
const snap=await getDoc(doc(db,'config','plans'))
if(snap.exists()){
const d=snap.data()
if(d.plans&&d.plans.length)setPlans(d.plans)
if(d.paymentAccounts&&d.paymentAccounts.length)setPaymentAccounts(d.paymentAccounts)
else if(d.paymentInfo){
setPaymentAccounts(Object.entries(d.paymentInfo).map(([k,v],i)=>({id:'acc'+(i+1),name:v.name||k,number:v.number||'',accountName:v.accountName||'',qrUrl:v.qrUrl||''})))
}
}
}catch(e){console.error('plans load:',e)}
setLoading(false)
}
load()
},[])

// helper functions
const getPlan=(key)=>plans.find(p=>p.key===normalizePlan(key))||plans[0]
const getLimit=(key,feature)=>{const p=getPlan(key);return p?.[feature]??0}
const canAdd=(key,feature,count)=>{const lim=getLimit(key,feature);return lim===-1?true:count<lim}
const planLabel=(key)=>getPlan(key)?.label||'Free Trial'
const planPrice=(key)=>getPlan(key)?.price||0
const canUse=(key,feature)=>getPlan(key)?.features?.[feature]===true
const paidPlans=()=>plans.filter(p=>p.key!=='free'&&p.active!==false)

return{plans,paymentAccounts,loading,getPlan,getLimit,canAdd,planLabel,planPrice,canUse,paidPlans}
}

export function formatMMK(amount){
return Number(amount||0).toLocaleString('en-US')+' MMK'
}
