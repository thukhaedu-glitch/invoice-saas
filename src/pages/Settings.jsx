import{useState,useEffect}from'react'
import{db,auth}from'../firebase'
import{doc,getDoc,setDoc,getDocs,collection,query,where}from'firebase/firestore'
import Layout from'../components/Layout'
import{Save,Upload,Building2,CreditCard,FileText,Plus,Trash2,Wallet}from'lucide-react'

export default function Settings(){
const[companyId,setCompanyId]=useState(null)
const[saving,setSaving]=useState(false)
const[settings,setSettings]=useState({
template:'classic',
primaryColor:'#4F6EF7',
logoUrl:'',
logoPosition:'left',
titlePosition:'left',
footerText:'Thank you for your business!',
showQR:true,
companyPhone:'',
companyEmail:'',
companyAddress:'',
companyWebsite:'',
trnNumber:'',
paymentTerms:'',
paymentMethods:[],
expenseCategories:['Office','Transport','Food','Utilities','Marketing','Salary','Equipment','Software','Other'],
})

useEffect(()=>{
const load=async()=>{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
setCompanyId(cid)
const sSnap=await getDoc(doc(db,'companies',cid,'_config','invoiceSettings'))
if(sSnap.exists())setSettings(s=>({...s,...sSnap.data()}))
}
}
load()
},[])

const save=async()=>{
setSaving(true)
await setDoc(doc(db,'companies',companyId,'_config','invoiceSettings'),settings)
setSaving(false)
alert('Saved!')
}

const handleLogo=e=>{
const file=e.target.files[0]
if(!file)return
const reader=new FileReader()
reader.onload=ev=>setSettings(s=>({...s,logoUrl:ev.target.result}))
reader.readAsDataURL(file)
}

const addPaymentMethod=()=>setSettings(s=>({...s,paymentMethods:[...s.paymentMethods,{bankName:'',accountNo:'',accountName:''}]}))
const updatePaymentMethod=(i,k,v)=>{
const arr=[...settings.paymentMethods]
arr[i]={...arr[i],[k]:v}
setSettings(s=>({...s,paymentMethods:arr}))
}
const removePaymentMethod=i=>setSettings(s=>({...s,paymentMethods:s.paymentMethods.filter((_,j)=>j!==i)}))

const addCategory=()=>setSettings(s=>({...s,expenseCategories:[...s.expenseCategories,'New Category']}))
const updateCategory=(i,v)=>{
const arr=[...settings.expenseCategories]
arr[i]=v
setSettings(s=>({...s,expenseCategories:arr}))
}
const removeCategory=i=>setSettings(s=>({...s,expenseCategories:s.expenseCategories.filter((_,j)=>j!==i)}))

const templates=['classic','modern','minimal','elegant']
const colors=['#4F6EF7','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#1a1d2e']
const positions=['left','center','right']

const Section=({title,icon:Icon,children})=>(
<div className="card" style={{padding:24,marginBottom:16}}>
<div style={{display:'flex',alignItems:'center',gap:8,fontWeight:600,fontSize:13,color:'var(--text-2)',marginBottom:16,textTransform:'uppercase',letterSpacing:'0.05em'}}>
<Icon size={15}/>{title}
</div>
{children}
</div>
)

const Field=({label,children})=>(
<div style={{marginBottom:12}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>{label}</label>
{children}
</div>
)

return(
<Layout title="Settings">
<div style={{maxWidth:640,margin:'0 auto'}}>

{/* Template */}
<Section title="Invoice Template" icon={FileText}>
<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
{templates.map(t=>(
<div key={t} onClick={()=>setSettings(s=>({...s,template:t}))} style={{
border:`2px solid ${settings.template===t?'var(--primary)':'var(--border)'}`,
borderRadius:10,padding:'12px 8px',textAlign:'center',cursor:'pointer',
background:settings.template===t?'var(--primary-light)':'white',
transition:'all 0.15s'
}}>
<div style={{fontSize:13,fontWeight:500,color:settings.template===t?'var(--primary)':'var(--text-2)',textTransform:'capitalize'}}>{t}</div>
</div>
))}
</div>
</Section>

{/* Color */}
<Section title="Primary Color" icon={FileText}>
<div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:12}}>
{colors.map(c=>(
<div key={c} onClick={()=>setSettings(s=>({...s,primaryColor:c}))} style={{
width:36,height:36,borderRadius:8,background:c,cursor:'pointer',
border:`3px solid ${settings.primaryColor===c?'#1a1d2e':'transparent'}`,
transition:'all 0.15s'
}}/>
))}
</div>
<div style={{display:'flex',alignItems:'center',gap:10}}>
<label style={{fontSize:12,color:'var(--text-2)'}}>Custom:</label>
<input type="color" value={settings.primaryColor} onChange={e=>setSettings(s=>({...s,primaryColor:e.target.value}))} style={{width:40,height:32,border:'none',borderRadius:6,cursor:'pointer'}}/>
<span style={{fontSize:13,color:'var(--text-2)'}}>{settings.primaryColor}</span>
</div>
</Section>

{/* Logo */}
<Section title="Logo & Layout" icon={Building2}>
<div style={{display:'flex',gap:16,alignItems:'flex-start',marginBottom:16}}>
<div style={{width:80,height:80,border:'0.5px dashed var(--border)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',background:'#f8fafc',overflow:'hidden',flexShrink:0}}>
{settings.logoUrl?<img src={settings.logoUrl} style={{width:'100%',height:'100%',objectFit:'contain'}}/>:<Upload size={24} color="var(--text-3)"/>}
</div>
<div>
<label style={{display:'block',marginBottom:8}}>
<input type="file" accept="image/*" onChange={handleLogo} style={{display:'none'}}/>
<span className="btn btn-ghost" style={{cursor:'pointer',fontSize:13}}>Upload Logo</span>
</label>
{settings.logoUrl&&<button type="button" onClick={()=>setSettings(s=>({...s,logoUrl:''}))} style={{background:'none',border:'none',color:'var(--danger)',fontSize:12,cursor:'pointer'}}>Remove</button>}
</div>
</div>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:8}}>Logo Position</label>
<div style={{display:'flex',gap:6}}>
{positions.map(p=>(
<button type="button" key={p} onClick={()=>setSettings(s=>({...s,logoPosition:p}))} className="btn" style={{fontSize:11,padding:'5px 10px',background:settings.logoPosition===p?'var(--primary)':'transparent',color:settings.logoPosition===p?'white':'var(--text-2)',border:`0.5px solid ${settings.logoPosition===p?'var(--primary)':'var(--border)'}`,textTransform:'capitalize'}}>{p}</button>
))}
</div>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:8}}>Title Position</label>
<div style={{display:'flex',gap:6}}>
{positions.map(p=>(
<button type="button" key={p} onClick={()=>setSettings(s=>({...s,titlePosition:p}))} className="btn" style={{fontSize:11,padding:'5px 10px',background:settings.titlePosition===p?'var(--primary)':'transparent',color:settings.titlePosition===p?'white':'var(--text-2)',border:`0.5px solid ${settings.titlePosition===p?'var(--primary)':'var(--border)'}`,textTransform:'capitalize'}}>{p}</button>
))}
</div>
</div>
</div>
</Section>

{/* Company Info */}
<Section title="Company Information" icon={Building2}>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
<Field label="Phone">
<input className="form-input" value={settings.companyPhone} onChange={e=>setSettings(s=>({...s,companyPhone:e.target.value}))} placeholder="09..."/>
</Field>
<Field label="Email">
<input className="form-input" value={settings.companyEmail} onChange={e=>setSettings(s=>({...s,companyEmail:e.target.value}))} placeholder="company@email.com"/>
</Field>
<Field label="Website">
<input className="form-input" value={settings.companyWebsite} onChange={e=>setSettings(s=>({...s,companyWebsite:e.target.value}))} placeholder="www.example.com"/>
</Field>
<Field label="TRN Number">
<input className="form-input" value={settings.trnNumber} onChange={e=>setSettings(s=>({...s,trnNumber:e.target.value}))} placeholder="TRN-000000"/>
</Field>
</div>
<Field label="Address">
<input className="form-input" value={settings.companyAddress} onChange={e=>setSettings(s=>({...s,companyAddress:e.target.value}))} placeholder="Company address..."/>
</Field>
</Section>

{/* Payment Methods */}
<Section title="Payment Methods" icon={CreditCard}>
<div style={{overflowX:'auto',marginBottom:12}}>
{settings.paymentMethods.length>0&&(
<table style={{width:'100%',borderCollapse:'collapse',fontSize:13,marginBottom:12}}>
<thead>
<tr style={{background:'#f8fafc'}}>
<th style={{padding:'8px 10px',textAlign:'left',fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase'}}>Bank Name</th>
<th style={{padding:'8px 10px',textAlign:'left',fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase'}}>Account No.</th>
<th style={{padding:'8px 10px',textAlign:'left',fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase'}}>Account Name</th>
<th style={{width:40}}></th>
</tr>
</thead>
<tbody>
{settings.paymentMethods.map((m,i)=>(
<tr key={i} style={{borderBottom:'0.5px solid var(--border)'}}>
<td style={{padding:'6px 8px'}}><input className="form-input" value={m.bankName} onChange={e=>updatePaymentMethod(i,'bankName',e.target.value)} placeholder="KBZ Bank..."/></td>
<td style={{padding:'6px 8px'}}><input className="form-input" value={m.accountNo} onChange={e=>updatePaymentMethod(i,'accountNo',e.target.value)} placeholder="0001234567"/></td>
<td style={{padding:'6px 8px'}}><input className="form-input" value={m.accountName} onChange={e=>updatePaymentMethod(i,'accountName',e.target.value)} placeholder="John Doe"/></td>
<td style={{padding:'6px 8px',textAlign:'center'}}>
<button type="button" onClick={()=>removePaymentMethod(i)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--danger)'}}>
<Trash2 size={14}/>
</button>
</td>
</tr>
))}
</tbody>
</table>
)}
<button type="button" onClick={addPaymentMethod} className="btn btn-ghost" style={{fontSize:13}}>
<Plus size={14}/>Add Payment Method
</button>
</div>
</Section>

{/* Expense Categories */}
<Section title="Expense Categories" icon={Wallet}>
<div style={{marginBottom:12}}>
{settings.expenseCategories.map((cat,i)=>(
<div key={i} style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
<input className="form-input" value={cat} onChange={e=>updateCategory(i,e.target.value)}/>
<button type="button" onClick={()=>removeCategory(i)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--danger)',flexShrink:0}}>
<Trash2 size={14}/>
</button>
</div>
))}
<button type="button" onClick={addCategory} className="btn btn-ghost" style={{fontSize:13}}>
<Plus size={14}/>Add Category
</button>
</div>
</Section>

{/* Payment Terms */}
<Section title="Payment Terms" icon={CreditCard}>
<Field label="Terms">
<input className="form-input" value={settings.paymentTerms} onChange={e=>setSettings(s=>({...s,paymentTerms:e.target.value}))} placeholder="e.g. Due on receipt, Net 30..."/>
</Field>
</Section>

{/* Footer & QR */}
<Section title="Footer & QR Code" icon={FileText}>
<Field label="Footer Text">
<input className="form-input" value={settings.footerText} onChange={e=>setSettings(s=>({...s,footerText:e.target.value}))} placeholder="Thank you for your business!"/>
</Field>
<div style={{display:'flex',alignItems:'center',gap:10}}>
<input type="checkbox" id="showQR" checked={settings.showQR} onChange={e=>setSettings(s=>({...s,showQR:e.target.checked}))} style={{width:16,height:16,cursor:'pointer'}}/>
<label htmlFor="showQR" style={{fontSize:13,color:'var(--text-1)',cursor:'pointer'}}>Show QR Code on invoice</label>
</div>
</Section>

<div style={{display:'flex',justifyContent:'flex-end'}}>
<button type="button" onClick={save} disabled={saving} className="btn btn-primary">
<Save size={15}/>{saving?'Saving...':'Save Settings'}
</button>
</div>
</div>
</Layout>
)
}
