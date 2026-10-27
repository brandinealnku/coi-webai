export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "content-type,x-admin-key",
      "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS"
    };
    if (request.method === "OPTIONS") return new Response(null, {headers:cors});
    const json = (data,status=200) => new Response(JSON.stringify(data), {status,headers:{...cors,"content-type":"application/json"}});
    const admin = () => request.headers.get("x-admin-key") === env.ADMIN_KEY;

    try {
      if (url.pathname === "/model" && request.method === "GET") {
        const row = await env.DB.prepare("SELECT value FROM config WHERE key='model'").first();
        return row ? new Response(row.value,{headers:{...cors,"content-type":"application/json"}}) : json({error:"model_not_configured"},404);
      }
      if (url.pathname === "/model" && request.method === "PUT") {
        if (!admin()) return json({error:"unauthorized"},401);
        const body = await request.json();
        if (!body?.classes || Object.keys(body.classes).length < 3) return json({error:"invalid_model"},400);
        await env.DB.prepare("INSERT INTO config(key,value,updated_at) VALUES('model',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(JSON.stringify(body)).run();
        return json({ok:true});
      }
      if (url.pathname === "/events" && request.method === "POST") {
        const body = await request.json();
        if (!body?.sessionId || !body?.event?.type) return json({error:"invalid_event"},400);
        const id = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO events(id,session_id,event_type,event_ts,payload) VALUES(?,?,?,?,?)")
          .bind(id,String(body.sessionId).slice(0,80),String(body.event.type).slice(0,80),body.event.at||new Date().toISOString(),JSON.stringify(body.event)).run();
        return json({ok:true,id},201);
      }
      if (url.pathname === "/events" && request.method === "GET") {
        if (!admin()) return json({error:"unauthorized"},401);
        const result = await env.DB.prepare("SELECT session_id,event_type,event_ts,payload,created_at FROM events ORDER BY created_at ASC LIMIT 10000").all();
        return json(result.results||[]);
      }
      if (url.pathname === "/health") return json({ok:true,service:"cmc-fossil-v4"});
      return json({error:"not_found"},404);
    } catch (e) {
      return json({error:"server_error",message:String(e?.message||e)},500);
    }
  }
};