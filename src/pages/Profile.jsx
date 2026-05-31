import{useState,useEffect}from'react'
import{db,auth,storage}from'../firebase'
import{doc,getDoc,setDoc,getDocs,collection,query,where,updateDoc}from'firebase/firestore'
import{updatePassword,updateEmail,reauthenticateWithCredential,EmailAuthProvider}from'firebase/auth'
import{ref,uploadBytes,getDownloadURL}from'firebase/storage'
import Layout from'../components/Layout'
import{Save,Upload,User,Lock,Building2,X}from'lucide-react'

export default function Profile(){
const[companyId,setCompanyId]=useState(null)
const[saving,setSaving]=useState(false)
const[uploadingAvatar,setUploadingAvatar]=useState(false)
const[pwModal,setPwModal]=useState(false)
const[profile,setProfile]=useState({
displayName:'',avatarUrl:'',phone:'',
})
const[company,setCompany]=useState({name:'',plan:'free'})
const[pwForm,setPwForm]=useState({current:'',newPw:'',confirm:''})
const[pwError,setPwError]=useState('')
const[savingPw,setSavingPw]=useState(false)

useEffect(()=>{
const load=async()=>{
const user=auth.currentUser
const snap=await getDocs(query(collection(db,'companies'),where(`members.${user.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
const cData=snap.docs[0].data()
setCompanyId(cid)
setCompany({name:cData.name||'',plan:cData.plan||'free'})
const pSnap=await getDoc(doc(db,'users',user.uid))
if(pSnap.exists())setProfile(p=>({...p,...pSnap.data()}))
else setProfile(p=>({...p,displayName:user.displayName||'',avatarUrl:user.photoURL||''}))
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

const save=async()=>{
setSaving(true)
try{
await setDoc(doc(db,'users',auth.currentUser.uid),{...profile},{ merge:true})
alert('Profile saved!')
}catch(e){alert(e.message)}
setSaving(false)
}

const handleChangePassword=async()=>{
setPwError('')
if(pwForm.newPw!==pwForm.confirm){setPwError('Passwords do not match');return}
if(pwForm.newPw.length<6){setPwError('Password must be at least 6 characters');return}
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

const Section=({title,icon:Icon,children})=>(
<div className="card" style={{padding:24,marginBottom:16}}>
<div style={{display:'flex',alignItems:'center',gap:8,fontWeight:600,fontSize:13,color:'var(--text-2)',marginBottom:16,textTransform:'uppercase',letterSpacing:'0.05em'}}>
<Icon size={15}/>{title}
</div>
{children}
</div>
)

return(
<Layout title="Profile">
<div style={{maxWidth:560,margin:'0 auto'}}>

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
{[
{label:'Current Password',key:'current'},
{label:'New Password',key:'newPw'},
{label:'Confirm Password',key:'confirm'},
].map(({label,key})=>(
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

{/* Avatar */}
<Section title="Profile" icon={User}>
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
<div style={{marginTop:8}}>
<span style={{background:'var(--primary-light)',color:'var(--primary)',padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,textTransform:'capitalize'}}>{company.plan} Plan</span>
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
<input className="form-input" value={profile.phone} onChange={e=>setProfile(p=>({...p,phone:e.target.value}))} placeholder="09..."/>
</div>
</div>
</Section>

{/* Company */}
<Section title="Company" icon={Building2}>
<div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'0.5px solid #f1f5f9'}}>
<span style={{fontSize:13,color:'var(--text-2)'}}>Company Name</span>
<span style={{fontSize:13,fontWeight:500}}>{company.name}</span>
</div>
<div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'0.5px solid #f1f5f9'}}>
<span style={{fontSize:13,color:'var(--text-2)'}}>Plan</span>
<span style={{fontSize:13,fontWeight:500,textTransform:'capitalize'}}>{company.plan}</span>
</div>
<div style={{display:'flex',justifyContent:'space-between',padding:'8px 0'}}>
<span style={{fontSize:13,color:'var(--text-2)'}}>Email</span>
<span style={{fontSize:13,fontWeight:500}}>{auth.currentUser?.email}</span>
</div>
</Section>

{/* Security */}
<Section title="Security" icon={Lock}>
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
