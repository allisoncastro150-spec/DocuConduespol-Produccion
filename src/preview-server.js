const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const documentRepository = require("./repositories/documentRepository");
const departmentRepository = require("./repositories/departmentRepository");
const userRepository = require("./repositories/userRepository");
const auditRepository = require("./repositories/auditRepository");

const port = Number(process.env.PORT || 3000);

const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const uploadDir = path.join(rootDir, "uploads");

const adminDeleteKey =
  process.env.ADMIN_DELETE_KEY || "ADMINISTRADOR_Eliminar";


const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf",
};


const sessions = new Map();


fs.mkdirSync(uploadDir, {
  recursive: true,
});



function hashPassword(password) {

  return crypto
    .createHash("sha256")
    .update(String(password))
    .digest("hex");

}



function sendJson(res, status, payload) {

  res.writeHead(status, {
    "Content-Type":
      "application/json; charset=utf-8",
  });

  res.end(JSON.stringify(payload));

}



function parseJsonBody(req) {

  return new Promise((resolve, reject) => {

    const chunks = [];

    req.on("data", chunk => {
      chunks.push(chunk);
    });


    req.on("end", () => {

      try {

        const text =
          Buffer.concat(chunks)
          .toString("utf8");


        resolve(
          text ? JSON.parse(text) : {}
        );


      } catch(error) {

        reject(error);

      }

    });


  });

}




function parseMultipart(req) {

  return new Promise((resolve,reject)=>{


    const contentType =
      req.headers["content-type"] || "";


    const boundaryMatch =
      contentType.match(
        /boundary=(?:"([^"]+)"|([^;]+))/i
      );


    if(!boundaryMatch){

      reject(
        new Error("No multipart boundary")
      );

      return;

    }



    const boundary =
      Buffer.from(
        `--${boundaryMatch[1] || boundaryMatch[2]}`
      );



    const chunks=[];


    req.on("data",chunk=>{
      chunks.push(chunk);
    });



    req.on("end",()=>{


      const body =
        Buffer.concat(chunks);


      const fields={};

      let file=null;


      let offset =
        body.indexOf(boundary);



      while(offset !== -1){


        offset += boundary.length;



        if(
          body.slice(offset,offset+2)
          .toString()==="--"
        ){
          break;
        }



        if(
          body.slice(offset,offset+2)
          .toString()==="\r\n"
        ){
          offset +=2;
        }



        const headerEnd =
          body.indexOf(
            Buffer.from("\r\n\r\n"),
            offset
          );



        if(headerEnd===-1)
          break;



        const headerText =
          body.slice(offset,headerEnd)
          .toString("utf8");



        const nextBoundary =
          body.indexOf(
            boundary,
            headerEnd+4
          );



        if(nextBoundary===-1)
          break;



        let content =
          body.slice(
            headerEnd+4,
            nextBoundary
          );



        if(
          content.slice(-2)
          .toString()==="\r\n"
        ){

          content =
            content.slice(0,-2);

        }



        const nameMatch =
          headerText.match(
            /name="([^"]+)"/
          );


        const filenameMatch =
          headerText.match(
            /filename="([^"]*)"/
          );


        const typeMatch =
          headerText.match(
            /Content-Type:\s*([^\r\n]+)/i
          );


        const name =
          nameMatch ? nameMatch[1] : "";



        if(filenameMatch && filenameMatch[1]){


          file={

            field:name,

            originalName:
              path.basename(filenameMatch[1]),

            mimeType:
              typeMatch
              ? typeMatch[1].trim()
              : "application/octet-stream",


            buffer:content,

            size:content.length,

          };


        }else if(name){


          fields[name] =
            content.toString("utf8");

        }


        offset=nextBoundary;

      }


      resolve({
        fields,
        file
      });


    });



    req.on("error",reject);


  });

}

 function currentUser(req){

    const auth = req.headers.authorization || "";

    const token = auth.startsWith("Bearer ")
        ? auth.slice(7)
        : new URL(
            req.url,
            `http://localhost:${port}`
        ).searchParams.get("token");

    return token
        ? sessions.get(token)
        : null;

}



function requireAuth(req,res){

  const user=currentUser(req);

  

  if(!user){

    sendJson(res,401,{
      message:"Inicia sesión para continuar."
    });

    return null;

  }

  return user;

}



async function handleApi(req,res,url){

/*=====================================================
LOGIN
=====================================================*/

if (
    req.method === "POST" &&
    url.pathname === "/api/login"
) {

    const body = await parseJsonBody(req);

    const user =
        await userRepository.findByUsername(
            body.username
        );

    console.log("========== LOGIN ==========");
    console.log("Usuario encontrado:");
    console.log(user);

    if (!user || !user.active) {

        console.log("❌ Usuario no existe o está inactivo");

        sendJson(res, 401, {
            message: "Credenciales incorrectas."
        });

        return;
    }

    const passwordOk = await bcrypt.compare(
        body.password,
        user.passwordHash
    );

    console.log("Contraseña escrita:", body.password);
    console.log("Hash BD:", user.passwordHash);
    console.log("¿Contraseña correcta?:", passwordOk);

    if (!passwordOk) {

        console.log("❌ Contraseña incorrecta");

        sendJson(res, 401, {
            message: "Credenciales incorrectas."
        });

        return;
    }

    console.log("✅ LOGIN CORRECTO");

    const token = crypto.randomBytes(32).toString("hex");

    const safeUser = {
        id: user.id,
        username: user.username,
        role: user.role,
        department: user.department
    };

    sessions.set(token, safeUser);

await auditRepository.create({

    username: user.username,

    action: "LOGIN",

    documentId: null,

    details: {
        descripcion: "Inicio de sesión",
        ip: req.socket.remoteAddress
    }

});
sendJson(res, 200, {

    token,

    user: safeUser

});

return;


}


/*=====================================================
LOGOUT
=====================================================*/

if(
    req.method==="POST" &&
    url.pathname==="/api/logout"
){

    const auth=
        req.headers.authorization || "";

    const token=
        auth.startsWith("Bearer ")
        ? auth.slice(7)
        : "";

    if(token){

        sessions.delete(token);

    }

    sendJson(res,200,{
        ok:true
    });

    return;

}



const user=
    requireAuth(req,res);

if(!user)
    return;



/*=====================================================
SESION
=====================================================*/

if(
    req.method==="GET" &&
    url.pathname==="/api/session"
){

    sendJson(res,200,{
        user
    });

    return;

}



/*=====================================================
DEPARTAMENTOS
=====================================================*/

if(
    req.method==="GET" &&
    url.pathname==="/api/departments"
){

    try{

        const departments=
            await departmentRepository.getAll();

        sendJson(
            res,
            200,
            departments
        );

    }

    catch(error){

        console.error(error);

        sendJson(res,500,{
            message:
            "Error al obtener departamentos."
        });

    }

    return;

}



/*=====================================================
ESTADISTICAS
=====================================================*/

if(
    req.method==="GET" &&
    url.pathname==="/api/stats"
){

    try{

        const documentStats=
            await documentRepository.getStats();

        const departments=
            await departmentRepository.getAll();

        const users=
            await userRepository.getAll();

        sendJson(res,200,{

            documents:
                documentStats.documents,

            departments:
                departments.length,

            uploadedToday:
                documentStats.uploadedToday,

            users:
                users.length,

            recent:
                documentStats.recent

        });

    }

    catch(error){

        console.error(error);

        sendJson(res,500,{
            message:
            "Error al obtener estadísticas."
        });

    }

    return;

}



/*=====================================================
BUSCAR DOCUMENTOS
=====================================================*/

if(
    req.method==="GET" &&
    url.pathname==="/api/documents"
){

    const docs=
        await documentRepository.search({

            user,

            code:
                url.searchParams.get("code")||"",

            q:
                url.searchParams.get("q")||"",

            department:
                url.searchParams.get("department")||"",

            from:
                url.searchParams.get("from")||"",

            to:
                url.searchParams.get("to")||""

        });

    sendJson(res,200,docs);

    return;

}

/*=====================================================
SUBIR DOCUMENTO
=====================================================*/

if (
    req.method === "POST" &&
    url.pathname === "/api/documents"
) {

    const { fields, file } =
        await parseMultipart(req);

    if (!file) {

        sendJson(res,400,{
            message:"Selecciona un archivo."
        });

        return;

    }


    let department;

    if (user.role === "admin") {

        department = fields.department;

    } else {

        // Siempre usar el departamento del usuario autenticado
        department = user.department;

    }

if (!department) {

    sendJson(res,400,{
        message:"Debe seleccionar un departamento."
    });

    return;

}

    const departmentData =
        await departmentRepository.findByName(
            department
        );

    if(!departmentData){

        sendJson(res,400,{
            message:"Departamento no encontrado."
        });

        return;

    }



    const uploader =
        await userRepository.findByUsername(
            user.username
        );

    if(!uploader){

        sendJson(res,400,{
            message:"Usuario no encontrado."
        });

        return;

    }



    const fileHash=
        crypto.createHash("sha256")
        .update(file.buffer)
        .digest("hex");



    const duplicated=
        await documentRepository.findByHash(
            fileHash
        );


    if(duplicated){

        sendJson(res,409,{

            duplicated:true,

            document:duplicated,

            message:
            "Este documento ya existe en el sistema."

        });

        return;

    }



    const code=
        await documentRepository.generateCode(
            departmentData.id
        );



    const extension=
        path.extname(file.originalName);



    const storedName=
        `${code}${extension}`;



    const folder=
        path.join(
            uploadDir,
            departmentData.name
        );



    fs.mkdirSync(folder,{
        recursive:true
    });



    const storagePath=
        path.join(
            folder,
            storedName
        );



    try{

    fs.writeFileSync(
        storagePath,
        file.buffer
    );

    const document =
        await documentRepository.create({

            code,
            originalName:file.originalName,
            storedName,
            fileHash,
            mimeType:file.mimeType,
            fileSize:file.size,
            storagePath,
            departmentId:departmentData.id,
            uploadedBy:uploader.id

        });

    await auditRepository.create({

    username: user.username,

    action: "UPLOAD",

    documentId: document.id,

    details: {
        descripcion: "Documento subido",
        ip: req.socket.remoteAddress
    }

});

    sendJson(
        res,
        201,
        document
    );
    }

    catch(error){

        console.error(error);

        if(error.code==="23505"){

            const existing=
                await documentRepository.findByHash(
                    fileHash
                );

            sendJson(res,409,{

                duplicated:true,

                document:existing,

                message:
                "Este documento ya existe."

            });

            return;

        }

        sendJson(res,500,{
            message:
            "Error al guardar documento."
        });

    }

    return;

}
/*=====================================================
DESCARGAR DOCUMENTO
=====================================================*/

if (
    req.method === "GET" &&
    url.pathname.startsWith("/api/documents/") &&
    url.pathname.endsWith("/download")
) {

    const id = url.pathname.split("/")[3];

    try {

        const document =
            await documentRepository.findById(id);

        if (!document) {

            res.writeHead(404);
            res.end("Documento no encontrado");
            return;

        }

        if (
            user.role !== "admin" &&
            document.department !== user.department
        ) {

            sendJson(res,403,{
                message:"No tiene permisos para descargar este documento."
            });

            return;

        }

        if (!fs.existsSync(document.storagePath)) {

            res.writeHead(404);
            res.end("Archivo no encontrado");
            return;

        }

        res.writeHead(200,{
            "Content-Type":document.mimeType,
            "Content-Disposition":
                `attachment; filename="${encodeURIComponent(document.originalName)}"`
        });

        fs.createReadStream(document.storagePath).pipe(res);

    }

    catch(error){

        console.error(error);

        sendJson(res,500,{
            message:"Error al descargar documento."
        });

    }

    return;

}



/*=====================================================
LISTAR USUARIOS
=====================================================*/

if(
    req.method==="GET" &&
    url.pathname==="/api/users"
){

    if(user.role!=="admin"){

        sendJson(res,403,{
            message:"Solo el administrador puede ver usuarios."
        });

        return;

    }

    try{

        const users=
            await userRepository.getAll();

        sendJson(res,200,users);

    }

    catch(error){

        console.error(error);

        sendJson(res,500,{
            message:"Error al obtener usuarios."
        });

    }

    return;

}



/*=====================================================
CREAR USUARIO
=====================================================*/

if(
    req.method==="POST" &&
    url.pathname==="/api/users"
){

    if(user.role!=="admin"){

        sendJson(res,403,{
            message:"Solo el administrador puede crear usuarios."
        });

        return;

    }

    const body=
        await parseJsonBody(req);

    if(
        !body.username ||
        !body.password ||
        !body.role
    ){

        sendJson(res,400,{
            message:"Completa todos los campos."
        });

        return;

    }

    const existing=
        await userRepository.findByUsername(
            body.username
        );

    if(existing){

        sendJson(res,400,{
            message:"Ese usuario ya existe."
        });

        return;

    }

    try{

        await userRepository.create({

            username:body.username,

            passwordHash:
                hashPassword(body.password),

            role:
                body.role==="admin"
                ? "admin"
                : "user",

            department:
                body.role==="admin"
                ? null
                : body.department

        });

        sendJson(res,201,{
            ok:true
        });

    }

    catch(error){

        console.error(error);

        sendJson(res,500,{
            message:"No se pudo crear el usuario."
        });

    }

    return;

}



/*=====================================================
ELIMINAR USUARIO
=====================================================*/

if(
    req.method==="DELETE" &&
    url.pathname.startsWith("/api/users/")
){

    if(user.role!=="admin"){

        sendJson(res,403,{
            message:"Solo el administrador puede eliminar usuarios."
        });

        return;

    }

    const username=
        decodeURIComponent(
            url.pathname.split("/")[3]
        );

    const key=
        url.searchParams.get("key");

    if(key!==adminDeleteKey){

        sendJson(res,403,{
            message:"Clave incorrecta."
        });

        return;

    }

    if(username==="admin"){

        sendJson(res,400,{
            message:"No se puede eliminar el administrador principal."
        });

        return;

    }

    try{

        await userRepository.deleteByUsername(username);
        sendJson(res,200,{
            ok:true
        });

    }

    catch(error){

        console.error(error);

        sendJson(res,500,{
            message:"No se pudo eliminar el usuario."
        });

    }

    return;

}

/*=====================================================
AUDITORIA
=====================================================*/

if (
    req.method === "GET" &&
    url.pathname === "/api/audit"
) {

    if (user.role !== "admin") {

        sendJson(res,403,{
            message:"Solo el administrador puede ver la auditoría."
        });

        return;

    }

    try{

        const logs =
            await auditRepository.getRecent(300);

        sendJson(
            res,
            200,
            logs
        );

    }

    catch(error){

        console.error(error);

        sendJson(res,500,{
            message:"Error al obtener auditoría."
        });

    }

    return;

}

sendJson(res,404,{
    message:"Ruta no encontrada."
});

}

function serveStatic(req, res, url) {

    const requested =
        url.pathname === "/"
        ? "/index.html"
        : url.pathname;

    const filePath =
        path.normalize(
            path.join(publicDir, requested)
        );

    if (!filePath.startsWith(publicDir)) {

        res.writeHead(403);
        res.end("Forbidden");
        return;

    }

    fs.readFile(filePath, (err, data) => {

        if (err) {

            fs.readFile(

                path.join(publicDir, "index.html"),

                (fallbackErr, fallback) => {

                    if (fallbackErr) {

                        res.writeHead(404);
                        res.end("Not found");
                        return;

                    }

                    res.writeHead(200, {
                        "Content-Type":
                            "text/html; charset=utf-8"
                    });

                    res.end(fallback);

                }

            );

            return;

        }

        res.writeHead(200, {

            "Content-Type":
                types[path.extname(filePath)] ||
                "application/octet-stream"

        });

        res.end(data);

    });

}



const server =
    http.createServer(

        async (req, res) => {

            try {

                const url =
                    new URL(
                        req.url,
                        `http://localhost:${port}`
                    );

                if (
                    url.pathname.startsWith("/api/")
                ) {

                    await handleApi(
                        req,
                        res,
                        url
                    );

                    return;

                }

                serveStatic(
                    req,
                    res,
                    url
                );

            }

            catch (error) {

                console.error(error);

                sendJson(
                    res,
                    500,
                    {
                        message:
                            error.message ||
                            "Error interno."
                    }
                );

            }

        }

    );



server.listen(

    port,

    "0.0.0.0",

    () => {

        console.log(
            `DOCUCONDUESPOL listo en http://localhost:${port}`
        );

    }

);