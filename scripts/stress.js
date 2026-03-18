
const counts = [1000, 5000]

counts.forEach(c=>{
  console.time('gen'+c)
  const nodes = Array.from({length:c}).map((_,i)=>({
    id:i,x:Math.random()*1000,y:Math.random()*1000
  }))
  console.timeEnd('gen'+c)
})
