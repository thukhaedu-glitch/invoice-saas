import{useState}from'react'
import{auth,db}from'../firebase'
import{createUserWithEmailAndPassword,signInWithEmailAndPassword}from'firebase/auth'
import{collection,getDocs,query,where,doc,setDoc,updateDoc,serverTimestamp}from'firebase/firestore'
import{useNavigate,Link}from'react-router-dom'
import{Mail,Lock,User,Hash,AlertCircle,Users,Phone}from'lucide-react'

export default function JoinCompany(){
const[email,setEmail]=useState('')
const[pass,setPass]=useState('')
const[name,setName]=useState('')
const[phone,setPhone]=useState('')
const[inviteCode,setInviteCode]=useState('')
const[error,setError]=useState('')
const[loading,setLoading]=useState(false)
const[mode,setMode]=useState('new')
const navigate=useNavigate()

const handleJoin=async e=>{
e.preventDefault()
if(mode==='new'&&!phone.trim()){setError('Phone number required');return}
setError('');setLoading(true)
try{
const snap=await getDocs(query(collection(db,'companies'),where('inviteCode','==',inviteCode.toUpperCase().trim())))
if(snap.empty){setError('Invalid invite code');setLoading(false);return}
const companyId=snap.docs[0].id
let uid
if(mode==='new'){
const cred=await createUserWithEmailAndPassword(auth,email,pass)
uid=cred.user.uid
}else{
const cred=await signInWithEmailAndPassword(auth,email,pass)
uid=cred.user.uid
}
await updateDoc(doc(db,'companies',companyId),{[`members.${uid}`]:'staff'})
await setDoc(doc(db,'users',uid),{
displayName:name||email,email,phone,role:'staff',
companyId,createdAt:serverTimestamp(),
},{merge:true})
// Save memberProfile
await setDoc(doc(db,'companies',companyId,'memberProfiles',uid),{
uid,email,phone,
role:'staff',
displayName:name||email,
joinedAt:new Date().toISOString(),
lastLogin:new Date().toISOString(),
})
navigate('/')
}catch(e){setError(e.message)}
setLoading(false)
}

return(
<div style={{minHeight:'100vh',background:'linear-gradient(135deg,#e8f0fe 0%,#f0f4ff 50%,#e8f8f0 100%)',display:'flex',alignItems:'center',justifyContent:'center',padding:20,position:'relative',overflow:'hidden'}}>
<div style={{position:'absolute',top:'-10%',left:'30%',width:400,height:400,borderRadius:'50%',background:'radial-gradient(circle,rgba(16,185,129,0.10),transparent 70%)',filter:'blur(40px)',pointerEvents:'none'}}/>
<div style={{position:'absolute',bottom:'-10%',right:'-5%',width:500,height:500,borderRadius:'50%',background:'radial-gradient(circle,rgba(79,110,247,0.08),transparent 70%)',filter:'blur(40px)',pointerEvents:'none'}}/>
<div style={{width:'100%',maxWidth:400,background:'rgba(255,255,255,0.72)',backdropFilter:'blur(20px) saturate(1.5)',WebkitBackdropFilter:'blur(20px) saturate(1.5)',border:'0.5px solid rgba(255,255,255,0.9)',borderRadius:20,boxShadow:'0 8px 32px rgba(79,110,247,0.10)',padding:'40px 36px'}}>
<div style={{textAlign:'center',marginBottom:32}}>
<div style={{width:52,height:52,background:'linear-gradient(135deg,#10b981,#4F6EF7)',borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px',boxShadow:'0 4px 16px rgba(16,185,129,0.3)'}}>
<Users size={24} color="white"/>
</div>
<div style={{fontSize:20,fontWeight:700,color:'var(--text-1)'}}>Join Company</div>
<div style={{fontSize:13,color:'var(--text-3)',marginTop:4}}>Enter invite code to join your team</div>
</div>
{error&&(
<div style={{background:'#fcebeb',border:'0.5px solid #fca5a5',color:'#dc2626',padding:'10px 14px',borderRadius:10,fontSize:13,marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
<AlertCircle size={15}/>{error}
</div>
)}
<div style={{display:'flex',gap:4,background:'var(--primary-light)',borderRadius:10,padding:4,marginBottom:20}}>
{[{id:'new',label:'New User'},{id:'existing',label:'Existing User'}].map(m=>(
<button type="button" key={m.id} onClick={()=>setMode(m.id)} style={{flex:1,padding:'8px',borderRadius:8,border:'none',cursor:'pointer',fontSize:13,fontWeight:500,background:mode===m.id?'white':'transparent',color:mode===m.id?'var(--primary)':'var(--text-2)',boxShadow:mode===m.id?'0 1px 4px rgba(0,0,0,0.08)':'none'}}>{m.label}</button>
))}
</div>
<form onSubmit={handleJoin}>
<div style={{marginBottom:12}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:5}}>Invite Code *</label>
<div style={{position:'relative'}}>
<Hash size={14} style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'var(--text-3)'}}/>
<input value={inviteCode} onChange={e=>setInviteCode(e.target.value)} required placeholder="INV-XXXXXX" className="form-input" style={{paddingLeft:34,textTransform:'uppercase'}}/>
</div>
</div>
{mode==='new'&&(
<div style={{marginBottom:12}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:5}}>Your Name</label>
<div style={{position:'relative'}}>
<User size={14} style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'var(--text-3)'}}/>
<input value={name} onChange={e=>setName(e.target.value)} required placeholder="Full name" className="form-input" style={{paddingLeft:34}}/>
</div>
</div>
)}
{mode==='new'&&(
<div style={{marginBottom:12}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:5}}>Phone Number</label>
<div style={{position:'relative'}}>
<Phone size={14} style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'var(--text-3)'}}/>
<input value={phone} onChange={e=>setPhone(e.target.value)} type="tel" required placeholder="e.g. 09xxxxxxxxx" className="form-input" style={{paddingLeft:34}}/>
</div>
</div>
)}
<div style={{marginBottom:12}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:5}}>Email</label>
<div style={{position:'relative'}}>
<Mail size={14} style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'var(--text-3)'}}/>
<input value={email} onChange={e=>setEmail(e.target.value)} type="email" required placeholder="your@email.com" className="form-input" style={{paddingLeft:34}}/>
</div>
</div>
<div style={{marginBottom:20}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:5}}>Password</label>
<div style={{position:'relative'}}>
<Lock size={14} style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'var(--text-3)'}}/>
<input value={pass} onChange={e=>setPass(e.target.value)} type="password" required placeholder="••••••••" className="form-input" style={{paddingLeft:34}}/>
</div>
</div>
<button type="submit" disabled={loading} className="btn btn-primary" style={{width:'100%',padding:'11px',fontSize:14,marginBottom:20,justifyContent:'center'}}>
{loading?'Joining...':'Join Company'}
</button>
</form>
<div style={{textAlign:'center',fontSize:13,color:'var(--text-3)'}}>
<Link to="/login" style={{color:'var(--primary)',fontWeight:500,textDecoration:'none'}}>Back to Login</Link>
{' · '}
<Link to="/signup" style={{color:'var(--primary)',fontWeight:500,textDecoration:'none'}}>Create company</Link>
</div>
</div>
</div>
)
}
