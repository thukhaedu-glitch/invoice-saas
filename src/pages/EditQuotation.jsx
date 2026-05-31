import{useState,useEffect}from'react'
import{db,auth,storage}from'../firebase'
import{collection,getDocs,query,where,doc,getDoc,updateDoc,serverTimestamp}from'firebase/firestore'
import{ref,uploadBytes,getDownloadURL}from'firebase/storage'
import{useNavigate,useParams}from'react-router-dom'
import Layout from'../components/Layout'
import{Plus,Trash2,Save,ArrowLeft,Image,X}from'lucide-react'

export default function EditQuotation(){
const{id}=useParams()
const navigate=useNavigate()
const[companyId,setCompanyId]=useState(null)
const[customers,setCustomers]=useState([])
const[saving,setSaving]=useState(false)
const[uploadingIdx,setUploadingIdx]=useState(null)
const[loading,setLoading]=useState(true)
const[form,setForm]=useState({
clientName:'',clientEmail:'',clientPhone:'',clientAddress:'',
quotationNumber:'',date:'',validUntil:'',
note:'',discount:0,taxRate:0,
})
const[items,setItems]=useState([{desc:'',qty:1,price:0,imageUrl:''}])

useEffect(()=>{
const load=async()=>{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
setCompanyId(cid)
const[cSnap,qSnap]=await Promise.all([
getDocs(collection(db,'companies',cid,'customers')),
getDoc(doc(db,'companies',cid,'quotations',id))
])
setCustomers(cSnap.docs.map(d=>({id:d.id,...d.data()})))
if(qSnap.exists()){
const q=qSnap.data()
setForm({
clientName:q.clientName||'',clientEmail:q.clientEmail||'',
clientPhone:q.clientPhone||'',clientAddress:q.clientAddress||'',
quotationNumber:q.quotationNumber||'',date:q.date||'',
validUntil:q.validUntil||'',note:q.note||'',
discount:q.discount||0,taxRate:q.taxRate||0,
})
setItems(q.items||[{desc:'',qty:1,price:0,imageUrl:''}])
}
}
setLoading(false)
}
load()
},[id])

const subtotal=items.reduce((s,i)=>s+Number(i.qty||1)*Number(i.price||0),0)
const tax=subtotal*(Number(form.taxRate)/100)
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
await updateDoc(doc(db,'companies',companyId,'quotations',id),{
...form,items,
discount:Number(form.discount),
taxRate:Number(form.taxRate),
totalAmount:total,
updatedAt:serverTimestamp(),
})
navigate('/?tab=quotation')
}catch(e){alert(e.message)}
setSaving(false)
}

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>

return(
<Layout title="Edit Quotation">
<div style={{maxWidth:760,margin:'0 auto'}}>
<div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
<button type="button" onClick={()=>navigate('/?tab=quotation')} className="btn btn-ghost" style={{padding:'8px 12px'}}>
<ArrowLeft size={16}/>
</button>
<h2 style={{fontSize:18,fontWeight:600,color:'var(--text-1)'}}>Edit Quotation</h2>
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
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Quotation No.</label>
<input className="form-input" value={form.quotationNumber} onChange={e=>setForm(f=>({...f,quotationNumber:e.target.value}))}/>
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
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Valid Until</label>
<input className="form-input" type="date" value={form.validUntil} onChange={e=>setForm(f=>({...f,validUntil:e.target.value}))}/>
</div>
<div style={{gridColumn:'1/-1'}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Address</label>
<input className="form-input" value={form.clientAddress} onChange={e=>setForm(f=>({...f,clientAddress:e.target.value}))} placeholder="Address..."/>
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
<input className="form-input" type="number" value={item.qty} onChange={e=>updateItem(i,'qty',e.target.value)} style={{textAlign:'center'}}/>
<input className="form-input" type="number" value={item.price} onChange={e=>updateItem(i,'price',e.target.value)} style={{textAlign:'right'}}/>
<div className="form-input" style={{display:'flex',alignItems:'center',justifyContent:'flex-end',fontWeight:500,background:'white'}}>
{(Number(item.qty||1)*Number(item.price||0)).toLocaleString()} Ks
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
{form.taxRate>0&&<div style={{marginBottom:4}}>+{Math.round(tax).toLocaleString()} Ks</div>}
<div style={{fontWeight:700,fontSize:16,marginTop:8}}>{Math.round(total).toLocaleString()} Ks</div>
</div>
</div>
</div>
</div>

<div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
<button type="button" onClick={()=>navigate('/?tab=quotation')} className="btn btn-ghost">Cancel</button>
<button type="button" onClick={save} disabled={saving} className="btn btn-primary">
<Save size={15}/>{saving?'Saving...':'Update Quotation'}
</button>
</div>
</div>
</Layout>
)
}
