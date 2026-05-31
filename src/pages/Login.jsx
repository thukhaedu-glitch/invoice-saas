import{useState}from'react'
import{auth}from'../firebase'
import{signInWithEmailAndPassword,GoogleAuthProvider,signInWithPopup}from'firebase/auth'
export default function Login(){
const[email,setEmail]=useState('')
const[pass,setPass]=useState('')
const[error,setError]=useState('')
const[loading,setLoading]=useState(false)
const login=async(e)=>{e.preventDefault();setLoading(true);try{await signInWithEmailAndPassword(auth,email,pass)}catch(err){setError(err.message);setLoading(false)}}
const googleLogin=async()=>{try{await signInWithPopup(auth,new GoogleAuthProvider())}catch(err){setError(err.message)}}
return(
<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f0f4ff'}}>
<div style={{background:'white',borderRadius:16,padding:32,width:'100%',maxWidth:400,boxShadow:'0 4px 24px rgba(0,0,0,0.08)'}}>
<h1 style={{fontSize:24,fontWeight:700,marginBottom:8,textAlign:'center'}}>Invoice SaaS</h1>
<p style={{color:'#888',textAlign:'center',marginBottom:24,fontSize:14}}>Sign in to continue</p>
<button onClick={googleLogin} style={{width:'100%',padding:'10px',border:'1px solid #ddd',borderRadius:8,background:'white',cursor:'pointer',marginBottom:16,fontSize:14}}>Sign in with Google</button>
{error&&<div style={{background:'#fef2f2',color:'#dc2626',padding:10,borderRadius:8,marginBottom:12,fontSize:13}}>{error}</div>}
<form onSubmit={login}>
<input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required style={{width:'100%',padding:'10px 12px',border:'1px solid #ddd',borderRadius:8,marginBottom:10,fontSize:14,boxSizing:'border-box'}}/>
<input type="password" placeholder="Password" value={pass} onChange={e=>setPass(e.target.value)} required style={{width:'100%',padding:'10px 12px',border:'1px solid #ddd',borderRadius:8,marginBottom:16,fontSize:14,boxSizing:'border-box'}}/>
<button type="submit" disabled={loading} style={{width:'100%',padding:'10px',background:'#2563eb',color:'white',border:'none',borderRadius:8,cursor:'pointer',fontSize:14,fontWeight:600}}>{loading?'Logging in...':'Login'}</button>
</form>
</div>
</div>
)
}