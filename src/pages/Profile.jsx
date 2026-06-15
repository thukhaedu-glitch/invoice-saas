import React,{useState,useEffect}from'react'
import{db,auth,storage}from'../firebase'
import{doc,getDoc,setDoc,getDocs,collection,query,where,updateDoc}from'firebase/firestore'
import{updatePassword,reauthenticateWithCredential,EmailAuthProvider}from'firebase/auth'
import{ref,uploadBytes,getDownloadURL}from'firebase/storage'
import Layout from'../components/Layout'
import{Save,Upload,User,Lock,Building2,X,Shield,Users,Copy,Check,PenLine,Trash2,UserMinus}from'lucide-react'
import{usePlans}from'../hooks/usePlans'

const Section=({title,icon:Icon,children})=>(
<div className="card" style={{padding:24,marginBottom:16}}>
<div style={{display:'flex',alignItems:'center',gap:8,fontWeight:600,fontSize:13,color:'var(--text-2)',marginBottom:16,textTransform:'uppercase',letterSpacing:'0.05em'}}>
<Icon size={15}/>{title}
</div>
{children}
</div>
)

export default function Profile(){
const{getLimit,planLabel}=usePlans()
const[companyId,setCompanyId]=useState(null)
const[saving,setSaving]=useState(false)
const[uploadingAvatar,setUploadingAvatar]=useState(false)
const[uploadingSignature,setUploadingSignature]=useState(false)
const[pwModal,setPwModal]=useState(false)
const[profile,setProfile]=useState({displayName:'',avatarUrl:'',signatureUrl:'',phone:'',role:'staff'})
const[company,setCompany]=useState({name:'',plan:'free',inviteCode:''})
const[members,setMembers]=useState([])
const[managedBy,setManagedBy]=useState({})
const[pwForm,setPwForm]=useState({current:'',newPw:'',confirm:''})
const[pwError,setPwError]=useState('')
const[savingPw,setSavingPw]=useState(false)
const[myRole,setMyRole]=useState('staff')
const[copied,setCopied]=useState(false)

useEffect(()=>{
const load=async()=>{
const user=auth.currentUser
const snap=await getDocs(query(collection(db,'companies'),where(`members.${user.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
const cData=snap.docs[0].data()
setCompanyId(cid)
setCompany({name:cData.name||'',plan:cData.plan||'free',inviteCode:cData.inviteCode||''})
const role=cData.members?.[user.uid]||'staff'
setMyRole(role)
setManagedBy(cData.managedBy||{})
const memberIds=Object.keys(cData.members||{})
const memberRoles=cData.members||{}
const memberProfiles=await Promise.all(memberIds.map(async uid=>{
const pSnap=await getDoc(doc(db,'users',uid))
const userData=pSnap.exists()?pSnap.data():{}
return{
uid,
role:memberRoles[uid],
displayName:userData.displayName||'',
email:userData.email||'',
avatarUrl:userData.avatarUrl||'',
phone:userData.phone||'',
}
}))
setMembers(memberProfiles)
const pSnap=await getDoc(doc(db,'users',user.uid))
if(pSnap.exists())setProfile(p=>({...p,...pSnap.data(),role}))
else setProfile(p=>({...p,displayName:user.displayName||'',avatarUrl:user.photoURL||'',role}))
}
}
load()
},[])

const handleAvatarUpload=async(e)=>{
const file=e.target.files[0]
if(!file)return
setUploadingAvatar(true)
try{
const storageRef=ref(storage,`avatars/${auth.currentUser.uid}`)
await uploadBytes(storageRef,file)
const url=await getDownloadURL(storageRef)
setProfile(p=>({...p,avatarUrl:url}))
}catch(err){console.error(err)}
setUploadingAvatar(false)
}

const handleSignatureUpload=async(e)=>{
const file=e.target.files[0]
if(!file)return
setUploadingSignature(true)
try{
const storageRef=ref(storage,`signatures/${auth.currentUser.uid}`)
await uploadBytes(storageRef,file)
const url=await getDownloadURL(storageRef)
setProfile(p=>({...p,signatureUrl:url}))
await setDoc(doc(db,'users',auth.currentUser.uid),{signatureUrl:url},{merge:true})
alert('Signature saved!')
}catch(err){console.error(err)}
setUploadingSignature(false)
}

const handleRemoveSignature=async()=>{
if(!confirm('Remove signature?'))return
setProfile(p=>({...p,signatureUrl:''}))
await setDoc(doc(db,'users',auth.currentUser.uid),{signatureUrl:''},{merge:true})
}

const save=async()=>{
setSaving(true)
try{
await setDoc(doc(db,'users',auth.currentUser.uid),{...profile},{merge:true})
alert('Profile saved!')
}catch(e){alert(e.message)}
setSaving(false)
}

const handleChangePassword=async()=>{
setPwError('')
if(pwForm.newPw!==pwForm.confirm){setPwError('Passwords do not match');return}
if(pwForm.newPw.length<6){setPwError('Min 6 characters');return}
setSavingPw(true)
try{
const credential=EmailAuthProvider.credential(auth.currentUser.email,pwForm.current)
await reauthenticateWithCredential(auth.currentUser,credential)
await updatePassword(auth.currentUser,pwForm.newPw)
setPwModal(false)
setPwForm({current:'',newPw:'',confirm:''})
alert('Password changed!')
}catch(e){setPwError(e.message)}
setSavingPw(false)
}

const handleRoleChange=async(uid,newRole)=>{
if(myRole!=='owner'){alert('Only owner can change roles');return}
try{
await updateDoc(doc(db,'companies',companyId),{[`members.${uid}`]:newRole})
setMembers(m=>m.map(mem=>mem.uid===uid?{...mem,role:newRole}:mem))
}catch(e){alert(e.message)}
}

const handleManagedByChange=async(staffUid,adminUid)=>{
if(myRole!=='owner'){alert('Only owner can assign managers');return}
try{
const newManagedBy={...managedBy}
if(adminUid===''){
delete newManagedBy[staffUid]
}else{
newManagedBy[staffUid]=adminUid
}
await updateDoc(doc(db,'companies',companyId),{managedBy:newManagedBy})
setManagedBy(newManagedBy)
}catch(e){alert(e.message)}
}

const handleRemoveMember=async(uid,memberEmail)=>{
if(myRole!=='owner'){alert('Only owner can remove members');return}
if(!confirm(`Remove ${memberEmail||uid} from company?`))return
try{
const cSnap=await getDoc(doc(db,'companies',companyId))
if(cSnap.exists()){
const mems=cSnap.data().members||{}
const mgBy=cSnap.data().managedBy||{}
delete mems[uid]
delete mgBy[uid]
// Remove this uid from managedBy values too
Object.keys(mgBy).forEach(k=>{if(mgBy[k]===uid)delete mgBy[k]})
await updateDoc(doc(db,'companies',companyId),{members:mems,managedBy:mgBy})
setMembers(m=>m.filter(mem=>mem.uid!==uid))
const newMgBy={...managedBy}
delete newMgBy[uid]
setManagedBy(newMgBy)
alert('Member removed!')
}
}catch(e){alert(e.message)}
}

const handleCopyInvite=()=>{
navigator.clipboard.writeText(company.inviteCode)
setCopied(true)
setTimeout(()=>setCopied(false),2000)
}

const roleColor={owner:'#4F6EF7',admin:'#16a34a',staff:'#d97706'}
const roleBg={owner:'rgba(79,110,247,0.1)',admin:'rgba(22,163,74,0.1)',staff:'rgba(217,119,6,0.1)'}
const adminMembers=members.filter(m=>m.role==='admin')

return(
<Layout title="Profile">
<div style={{maxWidth:720,margin:'0 auto'}}>

{/* Password Modal */}
{pwModal&&(
<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
<div style={{background:'white',borderRadius:16,width:'100%',maxWidth:400,boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
<div style={{padding:'20px 24px',borderBottom:'0.5px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div style={{fontWeight:600,fontSize:15}}>Change Password</div>
<button type="button" onClick={()=>setPwModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)'}}><X size={18}/></button>
</div>
<div style={{padding:24}}>
{pwError&&<div style={{background:'#fcebeb',color:'#dc2626',padding:'8px 12px',borderRadius:8,fontSize:13,marginBottom:12}}>{pwError}</div>}
{[{label:'Current Password',key:'current'},{label:'New Password',key:'newPw'},{label:'Confirm Password',key:'confirm'}].map(({label,key})=>(
<div key={key} style={{marginBottom:12}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>{label}</label>
<input className="form-input" type="password" value={pwForm[key]} onChange={e=>setPwForm(f=>({...f,[key]:e.target.value}))} placeholder="••••••••"/>
</div>
))}
<div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
<button type="button" onClick={()=>setPwModal(false)} className="btn btn-ghost">Cancel</button>
<button type="button" onClick={handleChangePassword} disabled={savingPw} className="btn btn-primary">
<Lock size={14}/>{savingPw?'Saving...':'Change Password'}
</button>
</div>
</div>
</div>
</div>
)}

{/* Profile */}
<Section title="My Profile" icon={User}>
<div style={{display:'flex',alignItems:'center',gap:20,marginBottom:20}}>
<div style={{position:'relative'}}>
<div style={{width:80,height:80,borderRadius:'50%',background:'var(--primary-light)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',border:'2px solid var(--primary)'}}>
{profile.avatarUrl?<img src={profile.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<User size={32} color="var(--primary)"/>}
</div>
<label style={{position:'absolute',bottom:0,right:0,cursor:'pointer'}}>
<input type="file" accept="image/*" onChange={handleAvatarUpload} style={{display:'none'}}/>
<div style={{width:24,height:24,background:'var(--primary)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid white'}}>
<Upload size={12} color="white"/>
</div>
</label>
</div>
<div>
<div style={{fontWeight:600,fontSize:16,color:'var(--text-1)'}}>{profile.displayName||auth.currentUser?.email}</div>
<div style={{fontSize:12,color:'var(--text-3)',marginTop:2}}>{auth.currentUser?.email}</div>
<div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}>
<span style={{background:roleBg[myRole]||'#f1f5f9',color:roleColor[myRole]||'#64748b',padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,textTransform:'capitalize'}}>{myRole}</span>
<span style={{background:'var(--primary-light)',color:'var(--primary)',padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600}}>{planLabel(company.plan)}</span>
</div>
</div>
</div>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
<div style={{gridColumn:'1/-1'}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Display Name</label>
<input className="form-input" value={profile.displayName} onChange={e=>setProfile(p=>({...p,displayName:e.target.value}))} placeholder="Your name..."/>
</div>
<div style={{gridColumn:'1/-1'}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Phone</label>
<input className="form-input" value={profile.phone||''} onChange={e=>setProfile(p=>({...p,phone:e.target.value}))} placeholder="09..."/>
</div>
</div>
</Section>

{/* Signature */}
<Section title="My Signature" icon={PenLine}>
<div style={{fontSize:12,color:'var(--text-3)',marginBottom:12}}>
လက်မှတ် ပုံ upload လုပ်ပါ — Invoice, Quotation, Contract မှာ auto-show ဖြစ်မည်။
</div>
{profile.signatureUrl?(
<div>
<div style={{border:'0.5px solid var(--border)',borderRadius:10,padding:16,background:'#f8fafc',marginBottom:12,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
<img src={profile.signatureUrl} style={{height:60,objectFit:'contain',maxWidth:200}} alt="Signature"/>
<button type="button" onClick={handleRemoveSignature} style={{background:'none',border:'none',cursor:'pointer',color:'var(--danger)',padding:4}}>
<Trash2 size={16}/>
</button>
</div>
<label style={{cursor:'pointer'}}>
<input type="file" accept="image/*" onChange={handleSignatureUpload} style={{display:'none'}}/>
<span className="btn btn-ghost" style={{fontSize:13}}>
<Upload size={14}/>{uploadingSignature?'Uploading...':'Change Signature'}
</span>
</label>
</div>
):(
<div>
<div style={{border:'1.5px dashed var(--border)',borderRadius:10,padding:32,textAlign:'center',marginBottom:12,background:'#fafbff'}}>
<PenLine size={32} color="var(--text-3)" style={{margin:'0 auto 8px'}}/>
<div style={{fontSize:13,color:'var(--text-3)',marginBottom:12}}>No signature uploaded yet</div>
<label style={{cursor:'pointer'}}>
<input type="file" accept="image/*" onChange={handleSignatureUpload} style={{display:'none'}}/>
<span className="btn btn-primary" style={{fontSize:13}}>
<Upload size={14}/>{uploadingSignature?'Uploading...':'Upload Signature'}
</span>
</label>
</div>
<div style={{fontSize:11,color:'var(--text-3)',padding:'8px 12px',background:'rgba(79,110,247,0.05)',borderRadius:8}}>
💡 လက်မှတ် ဓာတ်ပုံ ရိုက်ပြီး ဖြူဆက်မရှိတဲ့ background နဲ့ upload လုပ်ပါ (PNG recommended)
</div>
</div>
)}
</Section>

{/* Company */}
<Section title="Company" icon={Building2}>
{[
{label:'Company Name',value:company.name},
{label:'My Role',value:<span style={{background:roleBg[myRole]||'#f1f5f9',color:roleColor[myRole]||'#64748b',padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,textTransform:'capitalize'}}>{myRole}</span>},
{label:'Plan',value:planLabel(company.plan)},
{label:'Email',value:auth.currentUser?.email},
].map(({label,value})=>(
<div key={label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'0.5px solid #f1f5f9'}}>
<span style={{fontSize:13,color:'var(--text-2)'}}>{label}</span>
<span style={{fontSize:13,fontWeight:500}}>{value}</span>
</div>
))}
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'0.5px solid #f1f5f9'}}>
<span style={{fontSize:13,color:'var(--text-2)'}}>Invite Code</span>
<div style={{display:'flex',alignItems:'center',gap:8}}>
{(()=>{
const lim=getLimit(company.plan,'members')
const atLimit=lim!==-1&&members.length>=lim
if(atLimit)return<span style={{fontSize:12,color:'#d97706',fontWeight:500}}>🔒 Limit reached ({members.length}/{lim})</span>
return<>
<span style={{fontFamily:'monospace',fontWeight:600,color:'var(--primary)',fontSize:14,letterSpacing:1}}>{company.inviteCode||'-'}</span>
{company.inviteCode&&(
<button type="button" onClick={handleCopyInvite} style={{background:'none',border:'none',cursor:'pointer',color:copied?'#16a34a':'var(--text-3)',padding:2}}>
{copied?<Check size={14}/>:<Copy size={14}/>}
</button>
)}
</>
})()}
</div>
</div>
{(()=>{
const lim=getLimit(company.plan,'members')
const atLimit=lim!==-1&&members.length>=lim
if(!atLimit)return null
return<div style={{fontSize:12,color:'#d97706',background:'#faeeda',padding:'8px 12px',borderRadius:8,marginTop:8}}>
Member limit ({lim}) ပြည့်ပါပြီ။ နောက်ထပ် member ထည့်ဖို့ <a href="/upgrade" style={{color:'var(--primary)',fontWeight:600}}>plan upgrade</a> လုပ်ပါ။
</div>
})()}
</Section>

{/* Organization */}
<Section title="Organization" icon={Users}>
<div style={{marginBottom:12,fontSize:12,color:'var(--text-3)'}}>
{members.length} member{members.length!==1?'s':''} in {company.name}
</div>
{members.map(m=>(
<div key={m.uid} style={{padding:'12px 0',borderBottom:'0.5px solid #f1f5f9'}}>
<div style={{display:'flex',alignItems:'center',gap:12,marginBottom:myRole==='owner'&&m.uid!==auth.currentUser?.uid?8:0}}>
<div style={{width:38,height:38,borderRadius:'50%',background:'var(--primary-light)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
{m.avatarUrl?<img src={m.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<User size={18} color="var(--primary)"/>}
</div>
<div style={{flex:1}}>
<div style={{fontSize:13,fontWeight:500,color:'var(--text-1)',display:'flex',alignItems:'center',gap:6}}>
{m.displayName||m.email||m.uid.slice(0,8)}
{m.uid===auth.currentUser?.uid&&<span style={{fontSize:10,color:'var(--text-3)'}}>(You)</span>}
</div>
<div style={{fontSize:11,color:'var(--text-3)',marginTop:1}}>{m.email||'-'}</div>
{/* Show assigned admin for staff */}
{m.role==='staff'&&managedBy[m.uid]&&(
<div style={{fontSize:11,color:'#16a34a',marginTop:2}}>
👤 {members.find(x=>x.uid===managedBy[m.uid])?.displayName||members.find(x=>x.uid===managedBy[m.uid])?.email||'Admin'}
</div>
)}
</div>
<span style={{background:roleBg[m.role]||'#f1f5f9',color:roleColor[m.role]||'#64748b',padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,textTransform:'capitalize',flexShrink:0}}>{m.role}</span>
</div>

{myRole==='owner'&&m.uid!==auth.currentUser?.uid&&(
<div style={{display:'flex',gap:8,paddingLeft:50,flexWrap:'wrap',alignItems:'center'}}>
<select value={m.role} onChange={e=>handleRoleChange(m.uid,e.target.value)} className="form-input" style={{width:'auto',fontSize:12,padding:'4px 8px'}}>
<option value="owner">Owner</option>
<option value="admin">Admin</option>
<option value="staff">Staff</option>
</select>
{/* Managed by — staff only */}
{m.role==='staff'&&(
<select value={managedBy[m.uid]||''} onChange={e=>handleManagedByChange(m.uid,e.target.value)} className="form-input" style={{width:'auto',fontSize:12,padding:'4px 8px'}}>
<option value="">No Admin Assigned</option>
{adminMembers.map(a=>(
<option key={a.uid} value={a.uid}>{a.displayName||a.email}</option>
))}
</select>
)}
<button type="button" onClick={()=>handleRemoveMember(m.uid,m.email)} style={{background:'rgba(220,38,38,0.1)',border:'none',cursor:'pointer',color:'#dc2626',padding:'4px 10px',borderRadius:6,fontSize:12,display:'flex',alignItems:'center',gap:4}}>
<UserMinus size={13}/>Remove
</button>
</div>
)}
</div>
))}
</Section>

{/* Security */}
<Section title="Security" icon={Shield}>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div>
<div style={{fontSize:13,fontWeight:500,color:'var(--text-1)'}}>Password</div>
<div style={{fontSize:12,color:'var(--text-3)',marginTop:2}}>Change your account password</div>
</div>
<button type="button" onClick={()=>setPwModal(true)} className="btn btn-ghost" style={{fontSize:13}}>
<Lock size={14}/>Change Password
</button>
</div>
</Section>

<div style={{display:'flex',justifyContent:'flex-end'}}>
<button type="button" onClick={save} disabled={saving||uploadingAvatar} className="btn btn-primary">
<Save size={15}/>{saving?'Saving...':'Save Profile'}
</button>
</div>
</div>
</Layout>
)
}
