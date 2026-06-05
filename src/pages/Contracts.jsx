import{useState,useEffect,useRef}from'react'
import{db,auth}from'../firebase'
import{collection,onSnapshot,getDocs,query,where,doc,deleteDoc,addDoc,updateDoc,serverTimestamp,getDoc}from'firebase/firestore'
import Layout from'../components/Layout'
import{Plus,Trash2,Edit,ScrollText,Search,Eye,Printer,Download,ArrowLeft,Link,Mail,ThumbsUp,XCircle}from'lucide-react'
import{QRCodeSVG}from'qrcode.react'
import html2canvas from'html2canvas'
import jsPDF from'jspdf'
import{useRole}from'../hooks/useRole'
import{sendInvoiceReminder}from'../utils/emailService'

const STATUS=['draft','active','expired','cancelled']
const statusColor={draft:'#64748b',active:'#16a34a',expired:'#d97706',cancelled:'#dc2626'}
const statusBg={draft:'#f1f5f9',active:'#eaf3de',expired:'#faeeda',cancelled:'#fcebeb'}

const DEFAULT_CONTENT=`<h2>Service Agreement</h2>
<p>This agreement is made between the parties listed below.</p>
<h3>1. Services</h3>
<p>The service provider agrees to provide the following services:</p>
<ul><li>Service item 1</li><li>Service item 2</li></ul>
<h3>2. Payment Terms</h3>
<p>Payment shall be made as agreed upon by both parties.</p>
<h3>3. Terms &amp; Conditions</h3>
<p>Both parties agree to the terms outlined in this contract.</p>`

export default function Contracts(){
const[companyId,setCompanyId]=useState(null)
const[company,setCompany]=useState(null)
const[settings,setSettings]=useState({})
const[companyInfo,setCompanyInfo]=useState({})
const[contracts,setContracts]=useState([])
const[customers,setCustomers]=useState([])
const[loading,setLoading]=useState(true)
const[search,setSearch]=useState('')
const[view,setView]=useState('list')
const[selected,setSelected]=useState(null)
const[saving,setSaving]=useState(false)
const[downloading,setDownloading]=useState(false)
const[sendingReminder,setSendingReminder]=useState(false)
const[staffName,setStaffName]=useState('')
const[adminName,setAdminName]=useState('')
const[ownerName,setOwnerName]=useState('')
const[staffSig,setStaffSig]=useState('')
const[adminSig,setAdminSig]=useState('')
const[ownerSig,setOwnerSig]=useState('')
const[form,setForm]=useState({
title:'Service Agreement',
clientName:'',clientEmail:'',clientPhone:'',
startDate:'',endDate:'',
value:0,status:'draft',
content:DEFAULT_CONTENT,
partyASign:'',partyBSign:'',
})
const printRef=useRef()
const editorRef=useRef()
const{role}=useRole()

useEffect(()=>{
if(view==='editor'&&editorRef.current){
editorRef.current.innerHTML=form.content||DEFAULT_CONTENT
}
},[view])

useEffect(()=>{
const load=async()=>{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
const cData=snap.docs[0].data()
setCompanyId(cid)
setCompany({id:cid,...cData})
const[cusSnap,sSnap]=await Promise.all([
getDocs(collection(db,'companies',cid,'customers')),
getDoc(doc(db,'companies',cid,'_config','invoiceSettings'))
])
setCustomers(cusSnap.docs.map(d=>({id:d.id,...d.data()})))
if(sSnap.exists()){
setSettings(sSnap.data())
const sd=sSnap.data()
setCompanyInfo({
name:sd.companyName||'',
email:sd.companyEmail||'',
phone:sd.companyPhone||'',
paymentMethods:sd.paymentMethods?.map(m=>`${m.bankName}: ${m.accountNo} (${m.accountName})`).join('\n')||''
})
}
onSnapshot(collection(db,'companies',cid,'contracts'),snap=>{
setContracts(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)))
setLoading(false)
})
}
}
load()
},[])

const execCmd=(cmd,val=null)=>{
document.execCommand(cmd,false,val)
editorRef.current?.focus()
}

const loadSignatureNames=async(cid,contract)=>{
try{
setStaffSig('')
setAdminSig('')
setOwnerSig('')
if(contract.createdBy){
const s=await getDoc(doc(db,'users',contract.createdBy))
if(s.exists()){
setStaffName(s.data().displayName||s.data().email||'Staff')
setStaffSig(s.data().signatureUrl||'')
}
}
if(contract.approvedBy){
const s=await getDoc(doc(db,'users',contract.approvedBy))
if(s.exists()){
setAdminName(s.data().displayName||s.data().email||'Admin')
setAdminSig(s.data().signatureUrl||'')
}
}
if(contract.ownerApprovedBy){
const s=await getDoc(doc(db,'users',contract.ownerApprovedBy))
if(s.exists()){
setOwnerName(s.data().displayName||s.data().email||'Owner')
setOwnerSig(s.data().signatureUrl||'')
}
}
}catch(e){console.error(e)}
}

const openNew=()=>{
setForm({
title:'Service Agreement',
clientName:'',clientEmail:'',clientPhone:'',
startDate:new Date().toISOString().split('T')[0],
endDate:'',value:0,status:'draft',
content:DEFAULT_CONTENT,
partyASign:'',partyBSign:'',
})
setSelected(null)
setView('editor')
}

const openEdit=(c)=>{
setForm({
title:c.title||'',
clientName:c.clientName||'',
clientEmail:c.clientEmail||'',
clientPhone:c.clientPhone||'',
startDate:c.startDate||'',
endDate:c.endDate||'',
value:c.value||0,
status:c.status||'draft',
content:c.content||DEFAULT_CONTENT,
partyASign:c.partyASign||'',
partyBSign:c.partyBSign||'',
})
setSelected(c)
setView('editor')
}

const openDetail=async(c)=>{
setSelected(c)
setStaffName('')
setAdminName('')
setOwnerName('')
setStaffSig('')
setAdminSig('')
setOwnerSig('')
await loadSignatureNames(companyId,c)
setView('detail')
}

const handleSave=async()=>{
if(!form.title||!form.clientName){alert('Title and client required');return}
const content=editorRef.current?.innerHTML||form.content
setSaving(true)
try{
if(!selected){
await addDoc(collection(db,'companies',companyId,'contracts'),{
...form,content,value:Number(form.value),
contractNumber:'CON-'+Date.now().toString().slice(-6),
securityCode:'SEC-'+Math.random().toString(36).substring(2,8).toUpperCase(),
createdAt:serverTimestamp(),
createdBy:auth.currentUser.uid,
})
}else{
await updateDoc(doc(db,'companies',companyId,'contracts',selected.id),{
...form,content,value:Number(form.value),updatedAt:serverTimestamp()
})
}
setView('list')
}catch(e){alert(e.message)}
setSaving(false)
}

const handleDelete=async(id)=>{
if(!confirm('Delete this contract?'))return
await deleteDoc(doc(db,'companies',companyId,'contracts',id))
}

const handleCancel=async(c)=>{
if(!confirm('Cancel this contract?'))return
await updateDoc(doc(db,'companies',companyId,'contracts',c.id),{status:'cancelled'})
if(selected?.id===c.id)setSelected({...selected,status:'cancelled'})
}

const handleApprove=async(c)=>{
if(role==='admin'){
await updateDoc(doc(db,'companies',companyId,'contracts',c.id),{
status:'active',
approvedBy:auth.currentUser.uid,
approvedAt:new Date().toISOString(),
})
setSelected(s=>({...s,status:'active',approvedBy:auth.currentUser.uid}))
alert('Contract approved ✓')
}else if(role==='owner'){
await updateDoc(doc(db,'companies',companyId,'contracts',c.id),{
status:'active',
ownerApprovedBy:auth.currentUser.uid,
ownerApprovedAt:new Date().toISOString(),
})
setSelected(s=>({...s,status:'active',ownerApprovedBy:auth.currentUser.uid}))
alert('Contract approved ✓')
}
}

const handleShareLink=(c)=>{
const url=`${window.location.origin}/verify/${companyId}/${c.securityCode||c.id}`
navigator.clipboard.writeText(url)
alert('Link copied!')
}

const handleSendEmail=async(c)=>{
if(!c.clientEmail){alert('This client has no email address.');return}
if(!confirm(`Send contract to ${c.clientName} (${c.clientEmail})?`))return
setSendingReminder(true)
try{
const result=await sendInvoiceReminder({
clientName:c.clientName,
clientEmail:c.clientEmail,
invoiceNumber:c.contractNumber,
amount:c.value||0,
status:c.status,
companyName:companyInfo.name,
companyEmail:companyInfo.email,
companyPhone:companyInfo.phone,
paymentMethods:companyInfo.paymentMethods,
invoiceLink:`${window.location.origin}/verify/${companyId}/${c.securityCode||c.id}`,
})
if(result.success)alert(`Email sent to ${c.clientEmail} ✓`)
else alert('Failed: '+result.error)
}catch(e){alert(e.message)}
setSendingReminder(false)
}

const handleDownloadPDF=async()=>{
setDownloading(true)
try{
const el=printRef.current
const canvas=await html2canvas(el,{scale:2,useCORS:true,backgroundColor:'#ffffff'})
const imgData=canvas.toDataURL('image/png')
const pdf=new jsPDF('p','mm','a4')
const pdfWidth=pdf.internal.pageSize.getWidth()
const pdfHeight=(canvas.height*pdfWidth)/canvas.width
pdf.addImage(imgData,'PNG',0,0,pdfWidth,pdfHeight)
pdf.save(`${selected?.contractNumber||'contract'}.pdf`)
}catch(e){console.error(e)}
setDownloading(false)
}

const filtered=contracts.filter(c=>
c.title?.toLowerCase().includes(search.toLowerCase())||
c.clientName?.toLowerCase().includes(search.toLowerCase())||
c.contractNumber?.toLowerCase().includes(search.toLowerCase())
)

const hasAdminApproval=!!selected?.approvedBy||!!selected?.adminApprovedBy
const hasOwnerApproval=!!selected?.ownerApprovedBy

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>

if(view==='editor')return(
<Layout title={selected?'Edit Contract':'New Contract'}>
<div style={{maxWidth:860,margin:'0 auto'}}>
<div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
<button type="button" onClick={()=>setView('list')} className="btn btn-ghost" style={{padding:'8px 12px'}}><ArrowLeft size={16}/></button>
<h2 style={{fontSize:18,fontWeight:600,flex:1}}>{selected?'Edit Contract':'New Contract'}</h2>
<button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary">
{saving?'Saving...':'Save Contract'}
</button>
</div>

<div className="card" style={{padding:20,marginBottom:16}}>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
<div style={{gridColumn:'1/-1'}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Contract Title *</label>
<input className="form-input" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Contract title..."/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Client Name *</label>
<input className="form-input" list="client-list" value={form.clientName} onChange={e=>setForm(f=>({...f,clientName:e.target.value}))} placeholder="Client name..."/>
<datalist id="client-list">{customers.map(c=><option key={c.id} value={c.name}/>)}</datalist>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Client Email</label>
<input className="form-input" value={form.clientEmail} onChange={e=>setForm(f=>({...f,clientEmail:e.target.value}))} placeholder="email@example.com"/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Start Date</label>
<input className="form-input" type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))}/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>End Date</label>
<input className="form-input" type="date" value={form.endDate} onChange={e=>setForm(f=>({...f,endDate:e.target.value}))}/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Contract Value (Ks)</label>
<input className="form-input" type="number" value={form.value} onChange={e=>setForm(f=>({...f,value:e.target.value}))} style={{textAlign:'right'}}/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Status</label>
<select className="form-input" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
{STATUS.map(s=><option key={s} value={s} style={{textTransform:'capitalize'}}>{s}</option>)}
</select>
</div>
</div>
</div>

{/* Rich Text Editor */}
<div className="card" style={{padding:20,marginBottom:16}}>
<div style={{fontSize:12,fontWeight:600,color:'var(--text-2)',marginBottom:12,textTransform:'uppercase',letterSpacing:'0.05em'}}>Contract Content</div>

{/* Toolbar */}
<div style={{display:'flex',flexWrap:'wrap',gap:4,padding:'8px',background:'#f8fafc',borderRadius:'8px 8px 0 0',border:'0.5px solid var(--border)',borderBottom:'none',alignItems:'center'}}>
{[
{cmd:'bold',label:<strong>B</strong>},
{cmd:'italic',label:<em>I</em>},
{cmd:'underline',label:<u>U</u>},
].map(({cmd,label})=>(
<button key={cmd} type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>execCmd(cmd)}
style={{padding:'4px 10px',borderRadius:6,border:'0.5px solid var(--border)',background:'white',cursor:'pointer',fontSize:13,minWidth:32}}>
{label}
</button>
))}
<div style={{width:1,background:'var(--border)',margin:'0 2px',alignSelf:'stretch'}}/>
{[
{cmd:'justifyLeft',label:'≡L'},
{cmd:'justifyCenter',label:'≡C'},
{cmd:'justifyRight',label:'≡R'},
].map(({cmd,label})=>(
<button key={cmd} type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>execCmd(cmd)}
style={{padding:'4px 8px',borderRadius:6,border:'0.5px solid var(--border)',background:'white',cursor:'pointer',fontSize:12}}>
{label}
</button>
))}
<div style={{width:1,background:'var(--border)',margin:'0 2px',alignSelf:'stretch'}}/>
<button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>execCmd('insertUnorderedList')}
style={{padding:'4px 10px',borderRadius:6,border:'0.5px solid var(--border)',background:'white',cursor:'pointer',fontSize:12}}>
- List
</button>
<button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>execCmd('insertOrderedList')}
style={{padding:'4px 10px',borderRadius:6,border:'0.5px solid var(--border)',background:'white',cursor:'pointer',fontSize:12}}>
1. List
</button>
<div style={{width:1,background:'var(--border)',margin:'0 2px',alignSelf:'stretch'}}/>
<select onMouseDown={e=>e.stopPropagation()} onChange={e=>execCmd('fontSize',e.target.value)} defaultValue="3"
style={{padding:'4px 8px',borderRadius:6,border:'0.5px solid var(--border)',background:'white',fontSize:12,cursor:'pointer'}}>
{[1,2,3,4,5,6,7].map(n=><option key={n} value={n}>Size {n}</option>)}
</select>
<div style={{width:1,background:'var(--border)',margin:'0 2px',alignSelf:'stretch'}}/>
{[
{cmd:'formatBlock',val:'h2',label:'H2'},
{cmd:'formatBlock',val:'h3',label:'H3'},
{cmd:'formatBlock',val:'p',label:'P'},
].map(({cmd,val,label})=>(
<button key={val} type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>execCmd(cmd,val)}
style={{padding:'4px 8px',borderRadius:6,border:'0.5px solid var(--border)',background:'white',cursor:'pointer',fontSize:12}}>
{label}
</button>
))}
</div>

{/* Editor area */}
<div
ref={editorRef}
contentEditable
suppressContentEditableWarning
onInput={e=>setForm(f=>({...f,content:e.currentTarget.innerHTML}))}
style={{
minHeight:400,padding:16,
border:'0.5px solid var(--border)',
borderRadius:'0 0 8px 8px',
fontSize:14,lineHeight:1.8,
outline:'none',
background:'white',
fontFamily:'inherit',
}}
/>
</div>

<div className="card" style={{padding:20,marginBottom:16}}>
<div style={{fontSize:12,fontWeight:600,color:'var(--text-2)',marginBottom:12,textTransform:'uppercase',letterSpacing:'0.05em'}}>Signatures</div>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Party A — {company?.name}</label>
<input className="form-input" value={form.partyASign} onChange={e=>setForm(f=>({...f,partyASign:e.target.value}))} placeholder="Signatory name..."/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Party B — {form.clientName||'Client'}</label>
<input className="form-input" value={form.partyBSign} onChange={e=>setForm(f=>({...f,partyBSign:e.target.value}))} placeholder="Signatory name..."/>
</div>
</div>
</div>
</div>
</Layout>
)

if(view==='detail'&&selected)return(
<>
<style>{`
@media print{
.no-print{display:none!important}
body{background:white!important;margin:0}
.print-area{box-shadow:none!important;border-radius:0!important;max-width:100%!important;margin:0!important}
@page{size:A4;margin:15mm}
}
`}</style>

<div className="no-print" style={{position:'fixed',top:0,left:0,right:0,zIndex:100,background:'rgba(255,255,255,0.95)',backdropFilter:'blur(12px)',borderBottom:'0.5px solid #e2e8f0',padding:'12px 24px',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
<button type="button" onClick={()=>setView('list')} className="btn btn-ghost" style={{padding:'8px 12px'}}><ArrowLeft size={16}/></button>
<span style={{flex:1,fontWeight:500,fontSize:15}}>{selected.contractNumber} — {selected.title}</span>
<button type="button" onClick={()=>handleShareLink(selected)} className="btn btn-ghost" style={{fontSize:13}}>
<Link size={14}/>Share Link
</button>
<button type="button" onClick={()=>handleSendEmail(selected)} disabled={sendingReminder} className="btn btn-ghost" style={{fontSize:13}}>
<Mail size={14}/>{sendingReminder?'Sending...':'Send Email'}
</button>
{(role==='admin'||role==='owner')&&selected.status==='draft'&&(
<button type="button" onClick={()=>handleApprove(selected)} className="btn btn-ghost" style={{fontSize:13,color:'#16a34a',borderColor:'#16a34a'}}>
<ThumbsUp size={14}/>Approve
</button>
)}
{(role==='owner'||role==='admin')&&selected.status!=='cancelled'&&(
<button type="button" onClick={()=>handleCancel(selected)} className="btn btn-ghost" style={{fontSize:13,color:'#dc2626',borderColor:'#dc2626'}}>
<XCircle size={14}/>Cancel
</button>
)}
<button type="button" onClick={()=>window.print()} className="btn btn-ghost"><Printer size={15}/>Print</button>
<button type="button" onClick={handleDownloadPDF} disabled={downloading} className="btn btn-primary">
<Download size={15}/>{downloading?'Generating...':'Download PDF'}
</button>
</div>

<div style={{minHeight:'100vh',background:'#f1f5f9',padding:'80px 24px 40px',display:'flex',justifyContent:'center'}}>
<div ref={printRef} className="print-area" style={{width:'210mm',background:'white',boxShadow:'0 4px 32px rgba(0,0,0,0.08)',padding:'40px 50px',fontFamily:'Georgia,serif'}}>

<div style={{textAlign:'center',marginBottom:32,borderBottom:'2px solid #1a1d2e',paddingBottom:24}}>
{settings.logoUrl&&<img src={settings.logoUrl} style={{height:60,objectFit:'contain',marginBottom:12}}/>}
<div style={{fontSize:22,fontWeight:700,color:'#1a1d2e',letterSpacing:1}}>{selected.title}</div>
<div style={{fontSize:13,color:'#64748b',marginTop:6}}>{selected.contractNumber}</div>
</div>

<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:32,marginBottom:28,padding:'16px 0',borderBottom:'0.5px solid #e2e8f0'}}>
<div>
<div style={{fontSize:10,fontWeight:700,color:'#9aa0b4',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6}}>Party A (Service Provider)</div>
<div style={{fontWeight:600,fontSize:15}}>{company?.name}</div>
{settings.companyAddress&&<div style={{fontSize:12,color:'#64748b',marginTop:2}}>{settings.companyAddress}</div>}
{settings.companyEmail&&<div style={{fontSize:12,color:'#64748b'}}>{settings.companyEmail}</div>}
{settings.companyPhone&&<div style={{fontSize:12,color:'#64748b'}}>{settings.companyPhone}</div>}
</div>
<div>
<div style={{fontSize:10,fontWeight:700,color:'#9aa0b4',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6}}>Party B (Client)</div>
<div style={{fontWeight:600,fontSize:15}}>{selected.clientName}</div>
{selected.clientEmail&&<div style={{fontSize:12,color:'#64748b',marginTop:2}}>{selected.clientEmail}</div>}
{selected.clientPhone&&<div style={{fontSize:12,color:'#64748b'}}>{selected.clientPhone}</div>}
</div>
</div>

<div style={{display:'flex',gap:24,marginBottom:28,fontSize:13,flexWrap:'wrap'}}>
{selected.startDate&&<div><span style={{color:'#9aa0b4'}}>Start Date: </span><strong>{selected.startDate}</strong></div>}
{selected.endDate&&<div><span style={{color:'#9aa0b4'}}>End Date: </span><strong>{selected.endDate}</strong></div>}
{selected.value>0&&<div><span style={{color:'#9aa0b4'}}>Contract Value: </span><strong>{Number(selected.value).toLocaleString()} Ks</strong></div>}
<div><span style={{color:'#9aa0b4'}}>Status: </span><strong style={{color:statusColor[selected.status],textTransform:'capitalize'}}>{selected.status}</strong></div>
</div>

<div style={{marginBottom:40,lineHeight:1.8,fontSize:13}} dangerouslySetInnerHTML={{__html:selected.content}}/>

<div style={{marginTop:40,paddingTop:24,borderTop:'0.5px solid #e2e8f0'}}>
<div style={{fontSize:11,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase',marginBottom:16,letterSpacing:'0.05em'}}>Authorized Signatures</div>
<div style={{display:'grid',gridTemplateColumns:`repeat(${hasOwnerApproval?3:hasAdminApproval?2:1},1fr)`,gap:24,marginBottom:24}}>

<div style={{textAlign:'center'}}>
<div style={{height:64,borderBottom:'1.5px solid #1a1d2e',marginBottom:8,display:'flex',alignItems:'flex-end',justifyContent:'center',paddingBottom:4}}>
{staffSig?<img src={staffSig} style={{height:56,maxWidth:120,objectFit:'contain'}}/>:<span style={{fontSize:12,color:'#64748b',fontStyle:'italic'}}>{staffName||'—'}</span>}
</div>
<div style={{fontSize:10,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase',letterSpacing:'0.05em'}}>Prepared by</div>
<div style={{fontSize:12,fontWeight:500,color:'#1a1d2e',marginTop:2}}>{staffName||'Staff'}</div>
{selected.createdAt?.seconds&&<div style={{fontSize:10,color:'#9aa0b4',marginTop:2}}>{new Date(selected.createdAt.seconds*1000).toLocaleDateString()}</div>}
</div>

{hasAdminApproval&&(
<div style={{textAlign:'center'}}>
<div style={{height:64,borderBottom:'1.5px solid #1a1d2e',marginBottom:8,display:'flex',alignItems:'flex-end',justifyContent:'center',paddingBottom:4}}>
{adminSig?<img src={adminSig} style={{height:56,maxWidth:120,objectFit:'contain'}}/>:<span style={{fontSize:12,color:'#64748b',fontStyle:'italic'}}>{adminName||'—'}</span>}
</div>
<div style={{fontSize:10,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase',letterSpacing:'0.05em'}}>Approved by</div>
<div style={{fontSize:12,fontWeight:500,color:'#1a1d2e',marginTop:2}}>{adminName||'Admin'}</div>
{selected.approvedAt&&<div style={{fontSize:10,color:'#9aa0b4',marginTop:2}}>{new Date(selected.approvedAt).toLocaleDateString()}</div>}
</div>
)}

{hasOwnerApproval&&(
<div style={{textAlign:'center'}}>
<div style={{height:64,borderBottom:'1.5px solid #1a1d2e',marginBottom:8,display:'flex',alignItems:'flex-end',justifyContent:'center',paddingBottom:4}}>
{ownerSig?<img src={ownerSig} style={{height:56,maxWidth:120,objectFit:'contain'}}/>:<span style={{fontSize:12,color:'#64748b',fontStyle:'italic'}}>{ownerName||'—'}</span>}
</div>
<div style={{fontSize:10,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase',letterSpacing:'0.05em'}}>Director Approved</div>
<div style={{fontSize:12,fontWeight:500,color:'#1a1d2e',marginTop:2}}>{ownerName||'Director'}</div>
{selected.ownerApprovedAt&&<div style={{fontSize:10,color:'#9aa0b4',marginTop:2}}>{new Date(selected.ownerApprovedAt).toLocaleDateString()}</div>}
</div>
)}
</div>

<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:40,paddingTop:24,borderTop:'0.5px solid #f1f5f9'}}>
<div>
<div style={{borderBottom:'1.5px solid #1a1d2e',paddingBottom:4,marginBottom:8,minHeight:48,display:'flex',alignItems:'flex-end'}}>
<span style={{fontSize:13,color:'#64748b',fontStyle:'italic'}}>{selected.partyASign||''}</span>
</div>
<div style={{fontSize:11,color:'#9aa0b4'}}>Party A Signature</div>
<div style={{fontSize:12,fontWeight:500,marginTop:2}}>{company?.name}</div>
</div>
<div>
<div style={{borderBottom:'1.5px solid #1a1d2e',paddingBottom:4,marginBottom:8,minHeight:48,display:'flex',alignItems:'flex-end'}}>
<span style={{fontSize:13,color:'#64748b',fontStyle:'italic'}}>{selected.partyBSign||''}</span>
</div>
<div style={{fontSize:11,color:'#9aa0b4'}}>Party B Signature</div>
<div style={{fontSize:12,fontWeight:500,marginTop:2}}>{selected.clientName}</div>
</div>
</div>
</div>

<div style={{marginTop:32,paddingTop:16,borderTop:'0.5px solid #e2e8f0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div>
<div style={{fontSize:10,color:'#9aa0b4',marginBottom:2}}>This contract is system-generated and does not require a physical seal.</div>
<div style={{fontSize:10,color:'#9aa0b4',marginBottom:2}}>Verify authenticity by scanning the QR code.</div>
<div style={{fontSize:10,color:'#9aa0b4'}}>System developed by Ankora-X</div>
</div>
{selected.securityCode&&(
<div style={{textAlign:'center'}}>
<QRCodeSVG value={`${window.location.origin}/verify/${companyId}/${selected.securityCode}`} size={64} fgColor="#1a1d2e"/>
<div style={{fontSize:9,color:'#9aa0b4',marginTop:4}}>Scan to verify</div>
</div>
)}
</div>

</div>
</div>
</>
)

return(
<Layout title="Contracts">
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,gap:12}}>
<div style={{position:'relative',flex:1,maxWidth:320}}>
<Search size={14} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-3)'}}/>
<input className="form-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search contracts..." style={{paddingLeft:32}}/>
</div>
<button type="button" onClick={openNew} className="btn btn-primary">
<Plus size={15}/>New Contract
</button>
</div>

<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
{STATUS.map(s=>(
<div key={s} className="card" style={{padding:16}}>
<div style={{fontSize:12,fontWeight:500,color:'var(--text-2)',marginBottom:6,textTransform:'capitalize'}}>{s}</div>
<div style={{fontSize:24,fontWeight:700,color:statusColor[s]}}>{contracts.filter(c=>c.status===s).length}</div>
<div style={{fontSize:11,color:'var(--text-3)',marginTop:2}}>{contracts.filter(c=>c.status===s).reduce((sum,c)=>sum+Number(c.value||0),0).toLocaleString()} Ks</div>
</div>
))}
</div>

<div className="card" style={{overflow:'hidden'}}>
{filtered.length===0?(
<div style={{padding:64,textAlign:'center',color:'var(--text-3)'}}>
<ScrollText size={40} style={{margin:'0 auto 12px',opacity:0.3}}/>
<div>{search?'No results':'No contracts yet'}</div>
</div>
):(
<table>
<thead>
<tr>
<th>Number</th><th>Title</th><th>Client</th><th style={{textAlign:'right'}}>Value</th><th>Start</th><th>End</th><th style={{textAlign:'center'}}>Status</th><th style={{textAlign:'center'}}>Actions</th>
</tr>
</thead>
<tbody>
{filtered.map(c=>(
<tr key={c.id}>
<td style={{color:'var(--primary)',fontFamily:'monospace',fontSize:12,fontWeight:500}}>{c.contractNumber}</td>
<td style={{fontWeight:500}}>{c.title}</td>
<td style={{color:'var(--text-2)'}}>{c.clientName}</td>
<td style={{textAlign:'right',fontWeight:500}}>{Number(c.value||0).toLocaleString()} Ks</td>
<td style={{color:'var(--text-3)',fontSize:12}}>{c.startDate||'-'}</td>
<td style={{color:'var(--text-3)',fontSize:12}}>{c.endDate||'-'}</td>
<td style={{textAlign:'center'}}>
<span style={{background:statusBg[c.status],color:statusColor[c.status],padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,textTransform:'capitalize'}}>{c.status}</span>
</td>
<td style={{textAlign:'center'}}>
<div style={{display:'flex',gap:4,justifyContent:'center'}}>
<button type="button" onClick={()=>openDetail(c)} title="View" style={{background:'none',border:'none',cursor:'pointer',color:'var(--primary)',padding:4,borderRadius:6}}><Eye size={14}/></button>
<button type="button" onClick={()=>openEdit(c)} title="Edit" style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-2)',padding:4,borderRadius:6}}><Edit size={14}/></button>
<button type="button" onClick={()=>handleShareLink(c)} title="Share link" style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-2)',padding:4,borderRadius:6}}><Link size={14}/></button>
<button type="button" onClick={()=>handleSendEmail(c)} title="Send email" style={{background:'none',border:'none',cursor:'pointer',color:'#4F6EF7',padding:4,borderRadius:6}}><Mail size={14}/></button>
{(role==='admin'||role==='owner')&&c.status==='draft'&&(
<button type="button" onClick={()=>handleApprove(c)} title="Approve" style={{background:'none',border:'none',cursor:'pointer',color:'#16a34a',padding:4,borderRadius:6}}><ThumbsUp size={14}/></button>
)}
{(role==='owner'||role==='admin')&&c.status!=='cancelled'&&(
<button type="button" onClick={()=>handleCancel(c)} title="Cancel" style={{background:'none',border:'none',cursor:'pointer',color:'#dc2626',padding:4,borderRadius:6}}><XCircle size={14}/></button>
)}
<button type="button" onClick={()=>handleDelete(c.id)} title="Delete" style={{background:'none',border:'none',cursor:'pointer',color:'var(--danger)',padding:4,borderRadius:6}}><Trash2 size={14}/></button>
</div>
</td>
</tr>
))}
</tbody>
</table>
)}
</div>
</Layout>
)
}
