import{useState}from'react'
import{auth,db}from'../firebase'
import{createUserWithEmailAndPassword,signInWithEmailAndPassword}from'firebase/auth'
import{collection,getDocs,query,where,doc,setDoc,updateDoc,serverTimestamp}from'firebase/firestore'
import{useNavigate,Link}from'react-router-dom'
import{Mail,Lock,User,Hash,AlertCircle,Users}from'lucide-react'

export default function JoinCompany(){
const[email,setEmail]=useState('')
const[pass,setPass]=useState('')
const[name,setName]=useState('')
const[inviteCode,setInviteCode]=useState('')
const[error,setError]=useState('')
const[loading,setLoading]=useState(false)
const[mode,setMode]=useState('join')
const navigate=useNavigate()

const inputStyle={
width:'100%',padding:'11px 14px 11px 38px',
background:'rgba(255,255,255,0.08)',
border:'1px solid rgba(255,255,255,0.12)',
borderRadius:10,color:'white',fontSize:14,
outline:'none',boxSizing:'border-box',
}

const handleJoin=async e=>{
e.preventDefault()
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
displayName:name||email,
email,role:'staff',
companyId,
createdAt:serverTimestamp(),
},{merge:true})
navigate('/')
}catch(e){setError(e.message)}
setLoading(false)
}

return(
<div style={{
minHeight:'100vh',
background:'linear-gradient(135deg,#0f0c29,#302b63,#24243e)',
display:'flex',alignItems:'center',justifyContent:'center',
padding:20,position:'relative',overflow:'hidden'
}}>
<div style={{position:'absolute',top:'-20%',left:'30%',width:500,height:500,borderRadius:'50%',background:'radial-gradient(circle,rgba(16,185,129,0.2),transparent 70%)',filter:'blur(40px)',pointerEvents:'none'}}/>
<div style={{position:'absolute',bottom:'-10%',right:'-10%',width:500,height:500,borderRadius:'50%',background:'radial-gradient(circle,rgba(79,110,247,0.2),transparent 70%)',filter:'blur(40px)',pointerEvents:'none'}}/>

<div style={{
width:'100%',maxWidth:420,
background:'rgba(255,255,255,0.07)',
backdropFilter:'blur(24px) saturate(1.8)',
WebkitBackdropFilter:'blur(24px) saturate(1.8)',
border:'1px solid rgba(255,255,255,0.12)',
borderRadius:24,
boxShadow:'0 32px 64px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.15)',
padding:'40px 36px',
}}>
<div style={{textAlign:'center',marginBottom:32}}>
<div style={{
width:56,height:56,
background:'linear-gradient(135deg,#10b981,#4F6EF7)',
borderRadius:16,
display:'flex',alignItems:'center',justifyContent:'center',
margin:'0 auto 16px',
boxShadow:'0 8px 24px rgba(16,185,129,0.4)',
}}>
<Users size={26} color="white"/>
</div>
<div style={{fontSize:22,fontWeight:700,color:'white'}}>Join Company</div>
<div style={{fontSize:13,color:'rgba(255,255,255,0.5)',marginTop:6}}>Enter your invite code to join</div>
</div>

{error&&(
<div style={{background:'rgba(220,38,38,0.15)',border:'1px solid rgba(220,38,38,0.3)',color:'#fca5a5',padding:'10px 14px',borderRadius:10,fontSize:13,marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
<AlertCircle size={15}/>{error}
</div>
)}

{/* Mode Toggle */}
<div style={{display:'flex',gap:4,background:'rgba(255,255,255,0.06)',borderRadius:10,padding:4,marginBottom:20}}>
{[{id:'new',label:'New User'},{id:'existing',label:'Existing User'}].map(m=>(
<button type="button" key={m.id} onClick={()=>setMode(m.id)} style={{
flex:1,padding:'8px',borderRadius:8,border:'none',cursor:'pointer',fontSize:13,fontWeight:500,
background:mode===m.id?'rgba(255,255,255,0.12)':'transparent',
color:mode===m.id?'white':'rgba(255,255,255,0.5)',
}}>{m.label}</button>
))}
</div>

<form onSubmit={handleJoin}>
<div style={{marginBottom:12}}>
<label style={{fontSize:12,fontWeight:500,color:'rgba(255,255,255,0.7)',display:'block',marginBottom:6}}>Invite Code *</label>
<div style={{position:'relative'}}>
<Hash size={15} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'rgba(255,255,255,0.4)'}}/>
<input value={inviteCode} onChange={e=>setInviteCode(e.target.value)} required placeholder="INV-XXXXXX" style={inputStyle}/>
</div>
</div>

{mode==='new'&&(
<div style={{marginBottom:12}}>
<label style={{fontSize:12,fontWeight:500,color:'rgba(255,255,255,0.7)',display:'block',marginBottom:6}}>Your Name</label>
<div style={{position:'relative'}}>
<User size={15} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'rgba(255,255,255,0.4)'}}/>
<input value={name} onChange={e=>setName(e.target.value)} required placeholder="Full name" style={inputStyle}/>
</div>
</div>
)}

<div style={{marginBottom:12}}>
<label style={{fontSize:12,fontWeight:500,color:'rgba(255,255,255,0.7)',display:'block',marginBottom:6}}>Email</label>
<div style={{position:'relative'}}>
<Mail size={15} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'rgba(255,255,255,0.4)'}}/>
<input value={email} onChange={e=>setEmail(e.target.value)} type="email" required placeholder="your@email.com" style={inputStyle}/>
</div>
</div>

<div style={{marginBottom:20}}>
<label style={{fontSize:12,fontWeight:500,color:'rgba(255,255,255,0.7)',display:'block',marginBottom:6}}>Password</label>
<div style={{position:'relative'}}>
<Lock size={15} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'rgba(255,255,255,0.4)'}}/>
<input value={pass} onChange={e=>setPass(e.target.value)} type="password" required placeholder="••••••••" style={inputStyle}/>
</div>
</div>

<button type="submit" disabled={loading} style={{
width:'100%',padding:'12px',
background:'linear-gradient(135deg,#10b981,#4F6EF7)',
border:'none',borderRadius:10,
color:'white',fontSize:14,fontWeight:600,
cursor:'pointer',marginBottom:24,
boxShadow:'0 4px 16px rgba(16,185,129,0.3)',
opacity:loading?0.7:1,
}}>
{loading?'Joining...':'Join Company'}
</button>
</form>

<div style={{textAlign:'center',fontSize:13,color:'rgba(255,255,255,0.5)'}}>
<Link to="/login" style={{color:'#818cf8',fontWeight:500,textDecoration:'none'}}>Back to Login</Link>
{' · '}
<Link to="/signup" style={{color:'#818cf8',fontWeight:500,textDecoration:'none'}}>Create company</Link>
</div>
</div>
</div>
)
}
