import{useState,useEffect}from'react'
import{db,auth,storage}from'../firebase'
import{collection,addDoc,getDocs,query,where,serverTimestamp}from'firebase/firestore'
import{ref,uploadBytes,getDownloadURL}from'firebase/storage'
import{useNavigate}from'react-router-dom'
import Layout from'../components/Layout'
import{Plus,Trash2,Save,ArrowLeft,Image,X}from'lucide-react'

export default function CreateInvoice(){
const navigate=useNavigate()
const[companyId,setCompanyId]=useState(null)
const[customers,setCustomers]=useState([])
const[projects,setProjects]=useState([])
const[saving,setSaving]=useState(false)
const[uploadingIdx,setUploadingIdx]=useState(null)
const[form,setForm]=useState({
clientName:'',clientEmail:'',clientPhone:'',clientAddress:'',
invoiceNumber:'INV-'+Date.now().toString().slice(-6),
date:new Date().toISOString().split('T')[0],
note:'',discount:0,taxRate:0,projectId:''
})
const[items,setItems]=useState([{desc:'',qty:1,price:0,imageUrl:''}])

useEffect(()=>{
const load=async()=>{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
setCompanyId(cid)
const[cSnap,pSnap]=await Promise.all([
getDocs(collection(db,'companies',cid,'customers')),
getDocs(collection(db,'companies',cid,'projects')),
])
setCustomers(cSnap.docs.map(d=>({id:d.id,...d.data()})))
setProjects(pSnap.docs.map(d=>({id:d.id,...d.data()})))
}
}
load()
},[])

const subtotal=items.reduce((s,i)=>s+i.qty*i.price,0)
const tax=subtotal*(form.taxRate/100)
const total=subtotal-Number(form.discount)+tax

const fillCustomer=name=>{
const c=customers.find(x=>x.name===name)
if(c)setForm(f=>({...f,clientName:c.name,clientEmail:c.email||'',clientPhone:c.phone||'',clientAddress:c.address||''}))
}

const updateItem=(i,k,v)=>{
const arr=[...items]
arr[i]={...arr[i],[k]:k==='desc'?v:Number(v)}
setItems(arr)
}

const handleImageUpload=async(i,file)=>{
if(!file)return
setUploadingIdx(i)
try{
const storageRef=ref(storage,`invoice-items/${companyId}/${Date.now()}_${file.name}`)
await uploadBytes(storageRef,file)
const url=await getDownloadURL(storageRef)
const arr=[...items]
arr[i]={...arr[i],imageUrl:url}
setItems(arr)
}catch(e){console.error(e);alert('Upload failed')}
setUploadingIdx(null)
}

const removeItemImage=i=>{
const arr=[...items]
arr[i]={...arr[i],imageUrl:''}
setItems(arr)
}

const save=async()=>{
if(!form.clientName||items.some(i=>!i.desc)){alert('Please fill required fields');return}
setSaving(true)
try{
await addDoc(collection(db,'companies',companyId,'invoices'),{
...form,items,
discount:Number(form.discount),
taxRate:Number(form.taxRate),
totalAmount:total,
status:'pending',
payments:[],
securityCode:'SEC-'+Math.random().toString(36).substring(2,8).toUpperCase(),
createdBy:auth.currentUser.uid,
createdAt:serverTimestamp(),
source:'manual',
})
navigate('/')
}catch(e){alert(e.message)}
setSaving(false)
}

return(
<Layout title="Create Invoice">
<div style={{maxWidth:760,margin:'0 auto'}}>
<div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
<button type="button" onClick={()=>navigate('/')} className="btn btn-ghost" style={{padding:'8px 12px'}}>
<ArrowLeft size={16}/>
</button>
<h2 style={{fontSize:18,fontWeight:600,color:'var(--text-1)'}}>New Invoice</h2>
</div>

{/* Client Info */}
<div className="card" style={{padding:20,marginBottom:16}}>
<div style={{fontWeight:600,fontSize:13,color:'var(--text-2)',marginBottom:12,textTransform:'uppercase',letterSpacing:'0.05em'}}>Client Information</div>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Client Name *</label>
<input className="form-input" list="customer-list" value={form.clientName} onChange={e=>{setForm(f=>({...f,clientName:e.target.value}));fillCustomer(e.target.value)}} placeholder="Name..."/>
<datalist id="customer-list">{customers.map(c=><option key={c.id} value={c.name}/>)}</datalist>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Invoice No.</label>
<input className="form-input" value={form.invoiceNumber} onChange={e=>setForm(f=>({...f,invoiceNumber:e.target.value}))}/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Email</label>
<input className="form-input" type="email" value={form.clientEmail} onChange={e=>setForm(f=>({...f,clientEmail:e.target.value}))} placeholder="email@example.com"/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Date</label>
<input className="form-input" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Phone</label>
<input className="form-input" value={form.clientPhone} onChange={e=>setForm(f=>({...f,clientPhone:e.target.value}))} placeholder="09..."/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Address</label>
<input className="form-input" value={form.clientAddress} onChange={e=>setForm(f=>({...f,clientAddress:e.target.value}))} placeholder="Address..."/>
</div>
{/* Project Link */}
<div style={{gridColumn:'1/-1'}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Link to Project (optional)</label>
<select className="form-input" value={form.projectId} onChange={e=>setForm(f=>({...f,projectId:e.target.value}))}>
<option value="">— No Project —</option>
{projects.map(p=><option key={p.id} value={p.id}>{p.name}{p.clientName?` (${p.clientName})`:''}</option>)}
</select>
</div>
</div>
</div>

{/* Items */}
<div className="card" style={{padding:20,marginBottom:16}}>
<div style={{fontWeight:600,fontSize:13,color:'var(--text-2)',marginBottom:12,textTransform:'uppercase',letterSpacing:'0.05em'}}>Items</div>
{items.map((item,i)=>(
<div key={i} style={{marginBottom:16,padding:16,background:'#f8fafc',borderRadius:10,border:'0.5px solid var(--border)'}}>
<div style={{display:'grid',gridTemplateColumns:'1fr 80px 120px 120px 36px',gap:8,marginBottom:8}}>
<input className="form-input" value={item.desc} onChange={e=>updateItem(i,'desc',e.target.value)} placeholder="Description *"/>
<input className="form-input" type="number" value={item.qty} onChange={e=>updateItem(i,'qty',e.target.value)} style={{textAlign:'center'}} placeholder="Qty"/>
<input className="form-input" type="number" value={item.price} onChange={e=>updateItem(i,'price',e.target.value)} style={{textAlign:'right'}} placeholder="Price"/>
<div className="form-input" style={{display:'flex',alignItems:'center',justifyContent:'flex-end',fontWeight:500,background:'white'}}>
{(item.qty*item.price).toLocaleString()} Ks
</div>
<button type="button" onClick={()=>items.length>1&&setItems(items.filter((_,j)=>j!==i))} style={{background:'none',border:'none',cursor:'pointer',color:'var(--danger)',display:'flex',alignItems:'center',justifyContent:'center'}}>
<Trash2 size={15}/>
</button>
</div>
<div style={{display:'flex',alignItems:'center',gap:10}}>
{item.imageUrl?(
<div style={{position:'relative',display:'inline-block'}}>
<img src={item.imageUrl} style={{height:64,width:64,objectFit:'cover',borderRadius:8,border:'0.5px solid var(--border)'}}/>
<button type="button" onClick={()=>removeItemImage(i)} style={{position:'absolute',top:-6,right:-6,background:'#ef4444',border:'none',borderRadius:'50%',width:18,height:18,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',padding:0}}>
<X size={10} color="white"/>
</button>
</div>
):(
<label style={{cursor:'pointer'}}>
<input type="file" accept="image/*" style={{display:'none'}} onChange={e=>handleImageUpload(i,e.target.files[0])}/>
<div className="btn btn-ghost" style={{fontSize:12,padding:'6px 12px',display:'flex',alignItems:'center',gap:6}}>
<Image size={14}/>{uploadingIdx===i?'Uploading...':'Add Image'}
</div>
</label>
)}
<span style={{fontSize:11,color:'var(--text-3)'}}>Optional image for this item</span>
</div>
</div>
))}
<button type="button" onClick={()=>setItems([...items,{desc:'',qty:1,price:0,imageUrl:''}])} className="btn btn-ghost" style={{fontSize:13}}>
<Plus size={15}/>Add Item
</button>
</div>

{/* Totals */}
<div className="card" style={{padding:20,marginBottom:16}}>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Note</label>
<input className="form-input" value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} placeholder="Note..."/>
</div>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Discount (Ks)</label>
<input className="form-input" type="number" value={form.discount} onChange={e=>setForm(f=>({...f,discount:e.target.value}))} style={{textAlign:'right'}}/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Tax (%)</label>
<input className="form-input" type="number" value={form.taxRate} onChange={e=>setForm(f=>({...f,taxRate:e.target.value}))} style={{textAlign:'right'}}/>
</div>
</div>
</div>
<div style={{borderTop:'0.5px solid var(--border)',paddingTop:16}}>
<div style={{display:'flex',justifyContent:'flex-end',gap:24,fontSize:13}}>
<div style={{textAlign:'right'}}>
<div style={{color:'var(--text-2)',marginBottom:4}}>Subtotal</div>
<div style={{color:'var(--text-2)',marginBottom:4}}>Discount</div>
{form.taxRate>0&&<div style={{color:'var(--text-2)',marginBottom:4}}>Tax ({form.taxRate}%)</div>}
<div style={{fontWeight:700,fontSize:16,color:'var(--text-1)',marginTop:8}}>Total</div>
</div>
<div style={{textAlign:'right',minWidth:120}}>
<div style={{marginBottom:4}}>{subtotal.toLocaleString()} Ks</div>
<div style={{color:'var(--danger)',marginBottom:4}}>-{Number(form.discount).toLocaleString()} Ks</div>
{form.taxRate>0&&<div style={{marginBottom:4}}>+{tax.toLocaleString()} Ks</div>}
<div style={{fontWeight:700,fontSize:16,marginTop:8}}>{total.toLocaleString()} Ks</div>
</div>
</div>
</div>
</div>

<div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
<button type="button" onClick={()=>navigate('/')} className="btn btn-ghost">Cancel</button>
<button type="button" onClick={save} disabled={saving} className="btn btn-primary">
<Save size={15}/>{saving?'Saving...':'Save Invoice'}
</button>
</div>
</div>
</Layout>
)
}
