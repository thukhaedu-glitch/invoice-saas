import{useState}from'react'
import{auth,db}from'../firebase'
import{createUserWithEmailAndPassword,GoogleAuthProvider,signInWithPopup}from'firebase/auth'
import{doc,setDoc,addDoc,collection,serverTimestamp}from'firebase/firestore'
import{useNavigate,Link}from'react-router-dom'
import{Mail,Lock,Eye,EyeOff,User,Building2,AlertCircle,UserPlus}from'lucide-react'

export default function Signup(){
const[step,setStep]=useState(1)
const[email,setEmail]=useState('')
const[pass,setPass]=useState('')
const[showPass,setShowPass]=useState(false)
const[name,setName]=useState('')
const[companyName,setCompanyName]=useState('')
const[error,setError]=useState('')
const[loading,setLoading]=useState(false)
const navigate=useNavigate()

const inputStyle={
width:'100%',padding:'11px 14px 11px 38px',
background:'rgba(255,255,255,0.08)',
border:'1px solid rgba(255,255,255,0.12)',
borderRadius:10,color:'white',fontSize:14,
outline:'none',boxSizing:'border-box',
}

const handleSignup=async e=>{
e.preventDefault()
if(!name||!companyName){setError('Please fill all fields');return}
setError('');setLoading(true)
try{
const cred=await createUserWithEmailAndPassword(auth,email,pass)
const uid=cred.user.uid
const companyRef=await addDoc(collection(db,'companies'),{
name:companyName,
plan:'free',
members:{[uid]:'owner'},
ownerId:uid,
inviteCode:'INV-'+Math.random().toString(36).substring(2,8).toUpperCase(),
createdAt:serverTimestamp(),
})
await setDoc(doc(db,'users',uid),{
displayName:name,
email,
role:'owner',
companyId:companyRef.id,
createdAt:serverTimestamp(),
})
navigate('/')
}catch(e){setError(e.message)}
setLoading(false)
}

const handleGoogle=async()=>{
setError('');setLoading(true)
try{
const cred=await signInWithPopup(auth,new GoogleAuthProvider())
setStep(2)
setEmail(cred.user.email||'')
setName(cred.user.displayName||'')
}catch(e){setError(e.message)}
setLoading(false)
}

const handleGoogleComplete=async e=>{
e.preventDefault()
if(!companyName){setError('Company name required');return}
setError('');setLoading(true)
try{
const uid=auth.currentUser.uid
const companyRef=await addDoc(collection(db,'companies'),{
name:companyName,
plan:'free',
members:{[uid]:'owner'},
ownerId:uid,
inviteCode:'INV-'+Math.random().toString(36).substring(2,8).toUpperCase(),
createdAt:serverTimestamp(),
})
await setDoc(doc(db,'users',uid),{
displayName:name||auth.currentUser.displayName,
email:auth.currentUser.email,
role:'owner',
companyId:companyRef.id,
createdAt:serverTimestamp(),
})
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
<div style={{position:'absolute',top:'-20%',right:'-10%',width:500,height:500,borderRadius:'50%',background:'radial-gradient(circle,rgba(139,92,246,0.3),transparent 70%)',filter:'blur(40px)',pointerEvents:'none'}}/>
<div style={{position:'absolute',bottom:'-20%',left:'-10%',width:600,height:600,borderRadius:'50%',background:'radial-gradient(circle,rgba(79,110,247,0.25),transparent 70%)',filter:'blur(40px)',pointerEvents:'none'}}/>

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
background:'linear-gradient(135deg,#8b5cf6,#4F6EF7)',
borderRadius:16,
display:'flex',alignItems:'center',justifyContent:'center',
margin:'0 auto 16px',
boxShadow:'0 8px 24px rgba(139,92,246,0.4)',
}}>
<UserPlus size={26} color="white"/>
</div>
<div style={{fontSize:22,fontWeight:700,color:'white'}}>Create Account</div>
<div style={{fontSize:13,color:'rgba(255,255,255,0.5)',marginTop:6}}>Set up your company on Invoice SaaS</div>
</div>

{error&&(
<div style={{background:'rgba(220,38,38,0.15)',border:'1px solid rgba(220,38,38,0.3)',color:'#fca5a5',padding:'10px 14px',borderRadius:10,fontSize:13,marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
<AlertCircle size={15}/>{error}
</div>
)}

<form onSubmit={step===1?handleSignup:handleGoogleComplete}>
{step===1&&<>
<div style={{marginBottom:12}}>
<label style={{fontSize:12,fontWeight:500,color:'rgba(255,255,255,0.7)',display:'block',marginBottom:6}}>Your Name</label>
<div style={{position:'relative'}}>
<User size={15} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'rgba(255,255,255,0.4)'}}/>
<input value={name} onChange={e=>setName(e.target.value)} required placeholder="Full name" style={inputStyle}/>
</div>
</div>
<div style={{marginBottom:12}}>
<label style={{fontSize:12,fontWeight:500,color:'rgba(255,255,255,0.7)',display:'block',marginBottom:6}}>Email</label>
<div style={{position:'relative'}}>
<Mail size={15} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'rgba(255,255,255,0.4)'}}/>
<input value={email} onChange={e=>setEmail(e.target.value)} type="email" required placeholder="your@email.com" style={inputStyle}/>
</div>
</div>
<div style={{marginBottom:12}}>
<label style={{fontSize:12,fontWeight:500,color:'rgba(255,255,255,0.7)',display:'block',marginBottom:6}}>Password</label>
<div style={{position:'relative'}}>
<Lock size={15} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'rgba(255,255,255,0.4)'}}/>
<input value={pass} onChange={e=>setPass(e.target.value)} type={showPass?'text':'password'} required placeholder="Min 6 characters" style={{...inputStyle,paddingRight:40}}/>
<button type="button" onClick={()=>setShowPass(v=>!v)} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.4)'}}>
{showPass?<EyeOff size={15}/>:<Eye size={15}/>}
</button>
</div>
</div>
</>}

<div style={{marginBottom:20}}>
<label style={{fontSize:12,fontWeight:500,color:'rgba(255,255,255,0.7)',display:'block',marginBottom:6}}>Company Name</label>
<div style={{position:'relative'}}>
<Building2 size={15} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'rgba(255,255,255,0.4)'}}/>
<input value={companyName} onChange={e=>setCompanyName(e.target.value)} required placeholder="Your company name" style={inputStyle}/>
</div>
</div>

<button type="submit" disabled={loading} style={{
width:'100%',padding:'12px',
background:'linear-gradient(135deg,#8b5cf6,#4F6EF7)',
border:'none',borderRadius:10,
color:'white',fontSize:14,fontWeight:600,
cursor:'pointer',marginBottom:16,
boxShadow:'0 4px 16px rgba(139,92,246,0.4)',
opacity:loading?0.7:1,
}}>
{loading?'Creating...':'Create Account'}
</button>
</form>

{step===1&&(
<>
<div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
<div style={{flex:1,height:'0.5px',background:'rgba(255,255,255,0.12)'}}/>
<span style={{fontSize:12,color:'rgba(255,255,255,0.4)'}}>or</span>
<div style={{flex:1,height:'0.5px',background:'rgba(255,255,255,0.12)'}}/>
</div>
<button type="button" onClick={handleGoogle} disabled={loading} style={{
width:'100%',padding:'11px',
background:'rgba(255,255,255,0.08)',
border:'1px solid rgba(255,255,255,0.12)',
borderRadius:10,color:'white',fontSize:14,cursor:'pointer',
display:'flex',alignItems:'center',justifyContent:'center',gap:10,
marginBottom:24,
}}>
<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
Sign up with Google
</button>
</>
)}

<div style={{textAlign:'center',fontSize:13,color:'rgba(255,255,255,0.5)'}}>
Already have an account?{' '}
<Link to="/login" style={{color:'#818cf8',fontWeight:500,textDecoration:'none'}}>Sign in</Link>
{' · '}
<Link to="/join" style={{color:'#818cf8',fontWeight:500,textDecoration:'none'}}>Join company</Link>
</div>
</div>
</div>
)
}
