import{useState,useEffect,useRef}from'react'
import{db,auth}from'../firebase'
import{collection,getDocs,query,where,doc,getDoc}from'firebase/firestore'
import Layout from'../components/Layout'
import{ArrowLeft,FileText,FileCheck,ScrollText,Phone,Mail,MapPin,User,TrendingUp,Clock,CheckCircle,Download}from'lucide-react'
import{useNavigate,useParams}from'react-router-dom'
import html2canvas from'html2canvas'
import jsPDF from'jspdf'

export default function CustomerDetail(){
const{id}=useParams()
const navigate=useNavigate()
const[companyId,setCompanyId]=useState(null)
const[customer,setCustomer]=useState(null)
const[invoices,setInvoices]=useState([])
const[quotations,setQuotations]=useState([])
const[contracts,setContracts]=useState([])
const[settings,setSettings]=useState({})
const[loading,setLoading]=useState(true)
const[activeTab,setActiveTab]=useState('invoices')
const[exportingPDF,setExportingPDF]=useState(false)
const statementRef=useRef()

useEffect(()=>{
const load=async()=>{
try{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
setCompanyId(cid)
const[custSnap,invSnap,quoSnap,conSnap,sSnap]=await Promise.all([
getDoc(doc(db,'companies',cid,'customers',id)),
getDocs(collection(db,'companies',cid,'invoices')),
getDocs(collection(db,'companies',cid,'quotations')),
getDocs(collection(db,'companies',cid,'contracts')),
getDoc(doc(db,'companies',cid,'_config','invoiceSettings')),
])
if(custSnap.exists())setCustomer({id:custSnap.id,...custSnap.data()})
if(sSnap.exists())setSettings(sSnap.data())
const custData=custSnap.data()
const name=custData?.name||''
setInvoices(invSnap.docs.map(d=>({id:d.id,...d.data()})).filter(i=>i.clientName===name).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)))
setQuotations(quoSnap.docs.map(d=>({id:d.id,...d.data()})).filter(q=>q.clientName===name).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)))
setContracts(conSnap.docs.map(d=>({id:d.id,...d.data()})).filter(c=>c.clientName===name).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)))
}
}catch(e){console.error(e)}
setLoading(false)
}
load()
},[id])

const statusBadge=(s)=>{
const color={paid:'#16a34a',pending:'#d97706',overdue:'#dc2626',partial:'#4F6EF7',draft:'#64748b',active:'#16a34a',expired:'#d97706',cancelled:'#dc2626'}
const bg={paid:'#eaf3de',pending:'#faeeda',overdue:'#fcebeb',partial:'rgba(79,110,247,0.1)',draft:'#f1f5f9',active:'#eaf3de',expired:'#faeeda',cancelled:'#fcebeb'}
return<span style={{background:bg[s]||'#f1f5f9',color:color[s]||'#64748b',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:600,textTransform:'capitalize'}}>{s||'-'}</span>
}

const totalRevenue=invoices.filter(i=>i.status==='paid'||i.status==='partial').reduce((s,i)=>s+Number(i.paidAmount||i.totalAmount||0),0)
const totalPending=invoices.filter(i=>i.status==='pending'||i.status==='partial').reduce((s,i)=>s+Number(i.remainingAmount||i.totalAmount||0),0)
const totalContracts=contracts.reduce((s,c)=>s+Number(c.value||0),0)
const totalBilled=invoices.reduce((s,i)=>s+Number(i.totalAmount||0),0)
const totalPaid=invoices.reduce((s,i)=>s+Number(i.paidAmount||0),0)
const outstanding=totalBilled-totalPaid

const handleExportPDF=async()=>{
setExportingPDF(true)
try{
const el=statementRef.current
el.style.display='block'
await new Promise(r=>setTimeout(r,100))
const canvas=await html2canvas(el,{scale:2,useCORS:true,backgroundColor:'#ffffff'})
const imgData=canvas.toDataURL('image/png')
const pdf=new jsPDF('p','mm','a4')
const pdfWidth=pdf.internal.pageSize.getWidth()
const pdfHeight=(canvas.height*pdfWidth)/canvas.width
pdf.addImage(imgData,'PNG',0,0,pdfWidth,pdfHeight)
pdf.save(`Statement_${customer?.name||'customer'}_${new Date().toISOString().split('T')[0]}.pdf`)
el.style.display='none'
}catch(e){alert(e.message)}
setExportingPDF(false)
}

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>
if(!customer)return<div style={{padding:40,textAlign:'center'}}>Customer not found</div>

const primaryColor=settings.primaryColor||'#4F6EF7'
const today=new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})

return(
<Layout title={customer.name}>
<div style={{maxWidth:900,margin:'0 auto'}}>

{/* Header */}
<div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
<button type="button" onClick={()=>navigate('/customers')} className="btn btn-ghost" style={{padding:'8px 12px'}}><ArrowLeft size={16}/></button>
<h2 style={{fontSize:18,fontWeight:600,flex:1}}>{customer.name}</h2>
<button type="button" onClick={handleExportPDF} disabled={exportingPDF} className="btn btn-primary" style={{gap:6}}>
<Download size={14}/>{exportingPDF?'Generating...':'Export Statement PDF'}
</button>
</div>

{/* Customer Info Card */}
<div className="card" style={{padding:24,marginBottom:16}}>
<div style={{display:'flex',alignItems:'flex-start',gap:20}}>
<div style={{width:56,height:56,borderRadius:16,background:'var(--primary-light)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
<User size={24} color="var(--primary)"/>
</div>
<div style={{flex:1}}>
<div style={{fontSize:20,fontWeight:700,color:'var(--text-1)',marginBottom:4}}>{customer.name}</div>
{customer.customerId&&<div style={{fontSize:12,color:'var(--text-3)',fontFamily:'monospace',marginBottom:8}}>ID: {customer.customerId}</div>}
<div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
{customer.phone&&<div style={{display:'flex',alignItems:'center',gap:6,fontSize:13,color:'var(--text-2)'}}><Phone size={13} color="var(--primary)"/>{customer.phone}</div>}
{customer.email&&<div style={{display:'flex',alignItems:'center',gap:6,fontSize:13,color:'var(--text-2)'}}><Mail size={13} color="var(--primary)"/>{customer.email}</div>}
{customer.address&&<div style={{display:'flex',alignItems:'center',gap:6,fontSize:13,color:'var(--text-2)'}}><MapPin size={13} color="var(--primary)"/>{customer.address}</div>}
</div>
</div>
</div>
</div>

{/* Stats */}
<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
{[
{label:'Total Invoices',value:invoices.length,icon:FileText,color:'#4F6EF7'},
{label:'Revenue',value:`${totalRevenue.toLocaleString()} Ks`,icon:CheckCircle,color:'#16a34a'},
{label:'Pending',value:`${totalPending.toLocaleString()} Ks`,icon:Clock,color:'#d97706'},
{label:'Contracts Value',value:`${totalContracts.toLocaleString()} Ks`,icon:TrendingUp,color:'#8b5cf6'},
].map(({label,value,icon:Icon,color})=>(
<div key={label} className="card" style={{padding:16}}>
<div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
<Icon size={15} color={color}/>
<span style={{fontSize:11,fontWeight:500,color:'var(--text-2)'}}>{label}</span>
</div>
<div style={{fontSize:16,fontWeight:700,color}}>{value}</div>
</div>
))}
</div>

{/* Tabs */}
<div style={{display:'flex',gap:4,background:'rgba(255,255,255,0.7)',border:'0.5px solid var(--border)',borderRadius:12,padding:4,marginBottom:16,width:'fit-content'}}>
{[
{id:'invoices',label:'Invoices',icon:FileText,count:invoices.length},
{id:'quotations',label:'Quotations',icon:FileCheck,count:quotations.length},
{id:'contracts',label:'Contracts',icon:ScrollText,count:contracts.length},
].map(({id,label,icon:Icon,count})=>(
<button type="button" key={id} onClick={()=>setActiveTab(id)} className="btn" style={{
padding:'7px 14px',borderRadius:8,fontSize:13,
background:activeTab===id?'var(--primary)':'transparent',
color:activeTab===id?'#fff':'var(--text-2)',
display:'flex',alignItems:'center',gap:6,
}}>
<Icon size={14}/>{label}
<span style={{
background:activeTab===id?'rgba(255,255,255,0.25)':'var(--primary-light)',
color:activeTab===id?'#fff':'var(--primary)',
borderRadius:99,padding:'1px 7px',fontSize:11,fontWeight:600,
}}>{count}</span>
</button>
))}
</div>

{/* Invoices Tab */}
{activeTab==='invoices'&&(
<div className="card" style={{overflow:'hidden'}}>
{invoices.length===0?(
<div style={{padding:48,textAlign:'center',color:'var(--text-3)'}}>
<FileText size={32} style={{margin:'0 auto 12px',opacity:0.3}}/>
<div>No invoices yet</div>
</div>
):(
<table>
<thead>
<tr>
<th>Number</th><th>Amount</th><th>Paid</th><th style={{textAlign:'center'}}>Status</th><th>Date</th><th style={{textAlign:'center'}}>Action</th>
</tr>
</thead>
<tbody>
{invoices.map(i=>(
<tr key={i.id} style={{cursor:'pointer'}} onClick={()=>navigate(`/invoice/${i.id}`)}>
<td style={{color:'var(--primary)',fontFamily:'monospace',fontSize:12,fontWeight:500}}>{i.invoiceNumber}</td>
<td style={{fontWeight:500}}>{Number(i.totalAmount||0).toLocaleString()} Ks</td>
<td style={{color:'#16a34a',fontSize:12}}>{i.paidAmount>0?`${Number(i.paidAmount).toLocaleString()} Ks`:'-'}</td>
<td style={{textAlign:'center'}}>{statusBadge(i.status)}</td>
<td style={{color:'var(--text-3)',fontSize:12}}>{i.date||'-'}</td>
<td style={{textAlign:'center'}}><button type="button" onClick={e=>{e.stopPropagation();navigate(`/invoice/${i.id}`)}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--primary)',fontSize:12}}>View</button></td>
</tr>
))}
</tbody>
</table>
)}
</div>
)}

{/* Quotations Tab */}
{activeTab==='quotations'&&(
<div className="card" style={{overflow:'hidden'}}>
{quotations.length===0?(
<div style={{padding:48,textAlign:'center',color:'var(--text-3)'}}>
<FileCheck size={32} style={{margin:'0 auto 12px',opacity:0.3}}/>
<div>No quotations yet</div>
</div>
):(
<table>
<thead>
<tr>
<th>Number</th><th>Amount</th><th>Date</th><th style={{textAlign:'center'}}>Action</th>
</tr>
</thead>
<tbody>
{quotations.map(q=>(
<tr key={q.id} style={{cursor:'pointer'}} onClick={()=>navigate(`/quotation/${q.id}`)}>
<td style={{color:'var(--primary)',fontFamily:'monospace',fontSize:12,fontWeight:500}}>{q.quotationNumber}</td>
<td style={{fontWeight:500}}>{Number(q.totalAmount||0).toLocaleString()} Ks</td>
<td style={{color:'var(--text-3)',fontSize:12}}>{q.date||'-'}</td>
<td style={{textAlign:'center'}}><button type="button" onClick={e=>{e.stopPropagation();navigate(`/quotation/${q.id}`)}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--primary)',fontSize:12}}>View</button></td>
</tr>
))}
</tbody>
</table>
)}
</div>
)}

{/* Contracts Tab */}
{activeTab==='contracts'&&(
<div className="card" style={{overflow:'hidden'}}>
{contracts.length===0?(
<div style={{padding:48,textAlign:'center',color:'var(--text-3)'}}>
<ScrollText size={32} style={{margin:'0 auto 12px',opacity:0.3}}/>
<div>No contracts yet</div>
</div>
):(
<table>
<thead>
<tr>
<th>Number</th><th>Title</th><th>Value</th><th style={{textAlign:'center'}}>Status</th><th>Date</th><th style={{textAlign:'center'}}>Action</th>
</tr>
</thead>
<tbody>
{contracts.map(c=>(
<tr key={c.id}>
<td style={{color:'var(--primary)',fontFamily:'monospace',fontSize:12,fontWeight:500}}>{c.contractNumber}</td>
<td style={{fontWeight:500}}>{c.title}</td>
<td style={{fontWeight:500}}>{Number(c.value||0).toLocaleString()} Ks</td>
<td style={{textAlign:'center'}}>{statusBadge(c.status)}</td>
<td style={{color:'var(--text-3)',fontSize:12}}>{c.startDate||'-'}</td>
<td style={{textAlign:'center'}}><button type="button" onClick={()=>navigate('/contracts')} style={{background:'none',border:'none',cursor:'pointer',color:'var(--primary)',fontSize:12}}>View</button></td>
</tr>
))}
</tbody>
</table>
)}
</div>
)}
</div>

{/* Hidden PDF Statement */}
<div ref={statementRef} style={{display:'none',position:'fixed',left:-9999,top:0,zIndex:-1}}>
<div style={{width:'210mm',background:'white',fontFamily:'Georgia,serif',padding:0}}>

{/* Statement Header */}
<div style={{background:primaryColor,padding:'28px 40px',color:'white'}}>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
<div>
{settings.logoUrl&&<img src={settings.logoUrl} style={{height:40,objectFit:'contain',marginBottom:8,filter:'brightness(0) invert(1)'}}/>}
<div style={{fontSize:18,fontWeight:700}}>{settings.companyName||'Company'}</div>
{settings.companyAddress&&<div style={{fontSize:11,opacity:0.8,marginTop:2}}>{settings.companyAddress}</div>}
{settings.companyPhone&&<div style={{fontSize:11,opacity:0.8}}>{settings.companyPhone}</div>}
{settings.companyEmail&&<div style={{fontSize:11,opacity:0.8}}>{settings.companyEmail}</div>}
</div>
<div style={{textAlign:'right'}}>
<div style={{fontSize:22,fontWeight:700,letterSpacing:2,opacity:0.9}}>CUSTOMER STATEMENT</div>
<div style={{fontSize:12,marginTop:4,opacity:0.8}}>Generated: {today}</div>
</div>
</div>
</div>

{/* Customer Info */}
<div style={{padding:'20px 40px',borderBottom:'1px solid #e2e8f0',background:'#f8fafc'}}>
<div style={{fontSize:10,fontWeight:700,color:'#9aa0b4',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6}}>Bill To</div>
<div style={{fontSize:16,fontWeight:700,color:'#1a1d2e'}}>{customer.name}</div>
{customer.customerId&&<div style={{fontSize:11,color:'#9aa0b4',fontFamily:'monospace'}}>ID: {customer.customerId}</div>}
{customer.phone&&<div style={{fontSize:12,color:'#64748b',marginTop:2}}>📞 {customer.phone}</div>}
{customer.email&&<div style={{fontSize:12,color:'#64748b'}}>✉️ {customer.email}</div>}
{customer.address&&<div style={{fontSize:12,color:'#64748b'}}>📍 {customer.address}</div>}
</div>

{/* Summary Cards */}
<div style={{padding:'16px 40px',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,borderBottom:'1px solid #e2e8f0'}}>
{[
{label:'Total Billed',value:totalBilled,color:primaryColor},
{label:'Total Paid',value:totalPaid,color:'#16a34a'},
{label:'Outstanding Balance',value:outstanding,color:outstanding>0?'#dc2626':'#16a34a'},
].map(({label,value,color})=>(
<div key={label} style={{padding:'12px 16px',background:'#f8fafc',borderRadius:8,borderLeft:`3px solid ${color}`}}>
<div style={{fontSize:10,color:'#9aa0b4',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>{label}</div>
<div style={{fontSize:18,fontWeight:700,color}}>{value.toLocaleString()} Ks</div>
</div>
))}
</div>

{/* Invoice Table */}
<div style={{padding:'20px 40px 0'}}>
<div style={{fontSize:11,fontWeight:700,color:'#9aa0b4',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:10}}>Invoice History</div>
<table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
<thead>
<tr style={{background:primaryColor,color:'white'}}>
<th style={{padding:'8px 10px',textAlign:'left',fontSize:10,fontWeight:600,textTransform:'uppercase'}}>Invoice #</th>
<th style={{padding:'8px 10px',textAlign:'left',fontSize:10,fontWeight:600,textTransform:'uppercase'}}>Date</th>
<th style={{padding:'8px 10px',textAlign:'right',fontSize:10,fontWeight:600,textTransform:'uppercase'}}>Amount</th>
<th style={{padding:'8px 10px',textAlign:'right',fontSize:10,fontWeight:600,textTransform:'uppercase'}}>Paid</th>
<th style={{padding:'8px 10px',textAlign:'right',fontSize:10,fontWeight:600,textTransform:'uppercase'}}>Balance</th>
<th style={{padding:'8px 10px',textAlign:'center',fontSize:10,fontWeight:600,textTransform:'uppercase'}}>Status</th>
</tr>
</thead>
<tbody>
{invoices.map((inv,idx)=>{
const bal=Number(inv.remainingAmount||inv.totalAmount||0)-Number(inv.paidAmount||0)
const statusColors={paid:'#16a34a',pending:'#d97706',overdue:'#dc2626',partial:'#4F6EF7'}
return(
<tr key={inv.id} style={{background:idx%2===0?'white':'#f8fafc',borderBottom:'0.5px solid #e2e8f0'}}>
<td style={{padding:'8px 10px',fontFamily:'monospace',color:primaryColor,fontWeight:500}}>{inv.invoiceNumber}</td>
<td style={{padding:'8px 10px',color:'#64748b'}}>{inv.date||'-'}</td>
<td style={{padding:'8px 10px',textAlign:'right',fontWeight:500}}>{Number(inv.totalAmount||0).toLocaleString()} Ks</td>
<td style={{padding:'8px 10px',textAlign:'right',color:'#16a34a'}}>{Number(inv.paidAmount||0).toLocaleString()} Ks</td>
<td style={{padding:'8px 10px',textAlign:'right',fontWeight:600,color:Number(inv.remainingAmount||0)>0?'#dc2626':'#16a34a'}}>{Number(inv.remainingAmount||0).toLocaleString()} Ks</td>
<td style={{padding:'8px 10px',textAlign:'center'}}>
<span style={{background:inv.status==='paid'?'#eaf3de':inv.status==='overdue'?'#fcebeb':'#faeeda',color:statusColors[inv.status]||'#64748b',padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:600,textTransform:'capitalize'}}>{inv.status}</span>
</td>
</tr>
)
})}
</tbody>
<tfoot>
<tr style={{background:'#f1f5f9',borderTop:'1.5px solid #e2e8f0'}}>
<td colSpan={2} style={{padding:'10px',fontWeight:700,fontSize:13}}>Total</td>
<td style={{padding:'10px',textAlign:'right',fontWeight:700,color:primaryColor}}>{totalBilled.toLocaleString()} Ks</td>
<td style={{padding:'10px',textAlign:'right',fontWeight:700,color:'#16a34a'}}>{totalPaid.toLocaleString()} Ks</td>
<td style={{padding:'10px',textAlign:'right',fontWeight:700,color:outstanding>0?'#dc2626':'#16a34a'}}>{outstanding.toLocaleString()} Ks</td>
<td/>
</tr>
</tfoot>
</table>
</div>

{/* Payment History */}
{invoices.some(i=>(i.payments||[]).length>0)&&(
<div style={{padding:'20px 40px 0'}}>
<div style={{fontSize:11,fontWeight:700,color:'#9aa0b4',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:10}}>Payment History</div>
<table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
<thead>
<tr style={{background:'#f1f5f9'}}>
<th style={{padding:'7px 10px',textAlign:'left',fontSize:10,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase'}}>Invoice #</th>
<th style={{padding:'7px 10px',textAlign:'left',fontSize:10,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase'}}>Payment Date</th>
<th style={{padding:'7px 10px',textAlign:'left',fontSize:10,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase'}}>Method</th>
<th style={{padding:'7px 10px',textAlign:'right',fontSize:10,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase'}}>Amount</th>
</tr>
</thead>
<tbody>
{invoices.flatMap(inv=>(inv.payments||[]).map((p,i)=>({...p,invoiceNumber:inv.invoiceNumber,_key:inv.id+i}))).sort((a,b)=>a.date?.localeCompare(b.date||'')).map(p=>(
<tr key={p._key} style={{borderBottom:'0.5px solid #f1f5f9'}}>
<td style={{padding:'7px 10px',fontFamily:'monospace',color:primaryColor,fontSize:11}}>{p.invoiceNumber}</td>
<td style={{padding:'7px 10px',color:'#64748b'}}>{p.date||'-'}</td>
<td style={{padding:'7px 10px',color:'#64748b'}}>{p.method||'-'}</td>
<td style={{padding:'7px 10px',textAlign:'right',fontWeight:600,color:'#16a34a'}}>{Number(p.amount||0).toLocaleString()} Ks</td>
</tr>
))}
</tbody>
</table>
</div>
)}

{/* Outstanding Banner */}
{outstanding>0&&(
<div style={{margin:'20px 40px 0',padding:'12px 16px',background:'#fcebeb',borderRadius:8,border:'1px solid #fca5a5',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<span style={{fontSize:13,fontWeight:600,color:'#dc2626'}}>⚠️ Outstanding Balance</span>
<span style={{fontSize:16,fontWeight:700,color:'#dc2626'}}>{outstanding.toLocaleString()} Ks</span>
</div>
)}

{/* Footer */}
<div style={{margin:'24px 40px 0',padding:'16px 0',borderTop:'1px solid #e2e8f0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div style={{fontSize:10,color:'#9aa0b4'}}>
<div>This is a computer-generated statement.</div>
<div>System powered by AnkoraX</div>
</div>
<div style={{fontSize:10,color:'#9aa0b4',textAlign:'right'}}>
<div>Generated on {today}</div>
{settings.companyEmail&&<div>{settings.companyEmail}</div>}
</div>
</div>

</div>
</div>

</Layout>
)
}
