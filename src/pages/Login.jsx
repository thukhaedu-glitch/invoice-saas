import{useState}from'react'
import{auth,db}from'../firebase'
import{signInWithEmailAndPassword,GoogleAuthProvider,signInWithPopup,sendPasswordResetEmail}from'firebase/auth'
import{collection,getDocs,query,where}from'firebase/firestore'
import{useNavigate,Link}from'react-router-dom'
import{Mail,Lock,Eye,EyeOff,AlertCircle,LogIn}from'lucide-react'
import{logAction}from'../utils/auditLog'

export default function Login(){
const[email,setEmail]=useState('')
const[pass,setPass]=useState('')
const[showPass,setShowPass]=useState(false)
const[error,setError]=useState('')
const[loading,setLoading]=useState(false)
const[resetMode,setResetMode]=useState(false)
const[resetSent,setResetSent]=useState(false)
const navigate=useNavigate()

const getCompanyId=async(uid)=>{
try{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${uid}`,'!=',null)))
if(!snap.empty)return snap.docs[0].id
}catch(e){}
return null
}

const login=async e=>{
e.preventDefault()
setError('');setLoading(true)
try{
const cred=await signInWithEmailAndPassword(auth,email,pass)
const cid=await getCompanyId(cred.user.uid)
if(cid){
await logAction(cid,{
action:'login',module:'auth',
description:`User logged in: ${cred.user.email}`,
metadata:{method:'email'},
})
}
navigate('/')
}catch(e){setError(e.message)}
setLoading(false)
}

const googleLogin=async()=>{
setError('');setLoading(true)
try{
const cred=await signInWithPopup(auth,new GoogleAuthProvider())
const cid=await getCompanyId(cred.user.uid)
if(cid){
await logAction(cid,{
action:'login',module:'auth',
description:`User logged in: ${cred.user.email}`,
metadata:{method:'google'},
})
}
navigate('/')
}catch(e){setError(e.message)}
setLoading(false)
}

const handleReset=async e=>{
e.preventDefault()
setError('');setLoading(true)
try{
await sendPasswordResetEmail(auth,email)
setResetSent(true)
}catch(e){setError(e.message)}
setLoading(false)
}

return(
<div style={{
minHeight:'100vh',
background:'linear-gradient(135deg,#e8f0fe 0%,#f0f4ff 50%,#e8f8f0 100%)',
display:'flex',alignItems:'center',justifyContent:'center',
padding:20,position:'relative',overflow:'hidden'
}}>
<div style={{position:'absolute',top:'-10%',left:'-5%',width:400,height:400,borderRadius:'50%',background:'radial-gradient(circle,rgba(79,110,247,0.12),transparent 70%)',filter:'blur(40px)',pointerEvents:'none'}}/>
<div style={{position:'absolute',bottom:'-10%',right:'-5%',width:500,height:500,borderRadius:'50%',background:'radial-gradient(circle,rgba(99,153,34,0.08),transparent 70%)',filter:'blur(40px)',pointerEvents:'none'}}/>

<div style={{
width:'100%',maxWidth:400,
background:'rgba(255,255,255,0.72)',
backdropFilter:'blur(20px) saturate(1.5)',
WebkitBackdropFilter:'blur(20px) saturate(1.5)',
border:'0.5px solid rgba(255,255,255,0.9)',
borderRadius:20,
boxShadow:'0 8px 32px rgba(79,110,247,0.10)',
padding:'40px 36px',
}}>

<div style={{textAlign:'center',marginBottom:32}}>
<div style={{
width:52,height:52,
background:'var(--primary)',
borderRadius:14,
display:'flex',alignItems:'center',justifyContent:'center',
margin:'0 auto 14px',
boxShadow:'0 4px 16px rgba(79,110,247,0.3)',
}}>
<LogIn size={24} color="white"/>
</div>
<div style={{fontSize:20,fontWeight:700,color:'var(--text-1)'}}>
{resetMode?'Reset Password':'Welcome Back'}
</div>
<div style={{fontSize:13,color:'var(--text-3)',marginTop:4}}>
{resetMode?'Enter your email to reset':'Sign in to AnkoraX'}
</div>
</div>

{error&&(
<div style={{background:'#fcebeb',border:'0.5px solid #fca5a5',color:'#dc2626',padding:'10px 14px',borderRadius:10,fontSize:13,marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
<AlertCircle size={15}/>{error}
</div>
)}

{resetSent?(
<div style={{background:'#eaf3de',border:'0.5px solid #86efac',color:'#16a34a',padding:'14px',borderRadius:10,fontSize:13,textAlign:'center',marginBottom:16}}>
✓ Reset email sent! Check your inbox.
</div>
):(
<form onSubmit={resetMode?handleReset:login}>
<div style={{marginBottom:12}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:5}}>Email</label>
<div style={{position:'relative'}}>
<Mail size={14} style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'var(--text-3)'}}/>
<input value={email} onChange={e=>setEmail(e.target.value)} type="email" required placeholder="your@email.com" className="form-input" style={{paddingLeft:34}}/>
</div>
</div>

{!resetMode&&(
<div style={{marginBottom:8}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:5}}>Password</label>
<div style={{position:'relative'}}>
<Lock size={14} style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'var(--text-3)'}}/>
<input value={pass} onChange={e=>setPass(e.target.value)} type={showPass?'text':'password'} required placeholder="••••••••" className="form-input" style={{paddingLeft:34,paddingRight:36}}/>
<button type="button" onClick={()=>setShowPass(v=>!v)} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--text-3)'}}>
{showPass?<EyeOff size={14}/>:<Eye size={14}/>}
</button>
</div>
</div>
)}

{!resetMode&&(
<div style={{textAlign:'right',marginBottom:18}}>
<button type="button" onClick={()=>setResetMode(true)} style={{background:'none',border:'none',color:'var(--primary)',fontSize:12,cursor:'pointer'}}>
Forgot password?
</button>
</div>
)}

<button type="submit" disabled={loading} className="btn btn-primary" style={{width:'100%',padding:'11px',fontSize:14,marginBottom:12,justifyContent:'center'}}>
{loading?'Please wait...':(resetMode?'Send Reset Email':'Sign In')}
</button>

{resetMode&&(
<button type="button" onClick={()=>{setResetMode(false);setResetSent(false);setError('')}} className="btn btn-ghost" style={{width:'100%',padding:'11px',fontSize:14,justifyContent:'center'}}>
Back to Login
</button>
)}
</form>
)}

{!resetMode&&!resetSent&&(
<>
<div style={{display:'flex',alignItems:'center',gap:12,margin:'16px 0'}}>
<div style={{flex:1,height:'0.5px',background:'var(--border)'}}/>
<span style={{fontSize:12,color:'var(--text-3)'}}>or</span>
<div style={{flex:1,height:'0.5px',background:'var(--border)'}}/>
</div>

<button type="button" onClick={googleLogin} disabled={loading} style={{
width:'100%',padding:'10px',
background:'white',border:'0.5px solid var(--border)',
borderRadius:10,color:'var(--text-1)',fontSize:13,cursor:'pointer',
display:'flex',alignItems:'center',justifyContent:'center',gap:10,
marginBottom:20,fontWeight:500,
boxShadow:'0 1px 4px rgba(0,0,0,0.06)',
}}>
<svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
Continue with Google
</button>

<div style={{textAlign:'center',fontSize:13,color:'var(--text-3)'}}>
Don't have an account?{' '}
<Link to="/signup" style={{color:'var(--primary)',fontWeight:500,textDecoration:'none'}}>Sign up</Link>
{' · '}
<Link to="/join" style={{color:'var(--primary)',fontWeight:500,textDecoration:'none'}}>Join company</Link>
</div>
</>
)}
</div>
</div>
)
}
