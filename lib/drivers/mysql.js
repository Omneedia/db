function qstr(str) {
	//if (typeof str === 'object') return "";
	try {
		var obj='\''+str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
			console.log('o');
			switch (char) {
				case "\0":
					return "\\0";
				case "\x08":
					return "\\b";
				case "\x09":
					return "\\t";
				case "\x1a":
					return "\\z";
				case "\n":
					return "\\n";
				case "\r":
					return "\\r";
				case "%":
					return "%";
				case "\"":
				case "'":
				case "\\":
					return "\\"+char; // prepends a backslash to backslash, percent,
									  // and double/single quotes
			}
		})+'\'';
	} catch(e) {
		return '\''+str+'\'';
	};
	return obj;
};

module.exports={
	connect: function(name,fn) {
		var db=require('mysql');
		function replaceClientOnDisconnect(client) {
			client.on("error", function (err) {
				if (!err.fatal) {
				  return;
				};
				if (err.code !== "PROTOCOL_CONNECTION_LOST") {
				  throw err;
				};		 
				// client.config is actually a ConnectionConfig instance, not the original
				// configuration. For most situations this is fine, but if you are doing 
				// something more advanced with your connection configuration, then 
				// you should check carefully as to whether this is actually going to do
				// what you think it should do.
				client = mysql.createConnection(client.config);
				replaceClientOnDisconnect(client);
				connection.connect(function (error) {
				  if (error) {
					// Well, we tried. The database has probably fallen over.
					// That's fairly fatal for most applications, so we might as
					// call it a day and go home.
					process.exit(1);
				  }
				});
			});
		};
		var connection = db.createConnection(name);
		connection.connect(function (err) {
			  if (err) {
				fn(err,null);
			  } else {
				fn(null,connection);
			  }
		});
		connection.on('error', function (err) {
		  fn(err,null);
		});
		replaceClientOnDisconnect(connection);
	},
	query: function(name,sql,fn) {
		this.connect(name,function(err,q) {
			if (err) fn('CONNECTION_REFUSED',err); else  {
				q.query(sql,function(err,rows,fields) {
					q.end();
					fn(err,rows);
				});			
			};
		});
	},
	model: function(name,sql,fn) {
		function getMySQLType(typ) {
			var types=require('mysql').Types;
			for (var el in types) {
				if (types[el]==typ) return el;
			};
		};
		var model={
			"type" : "raw",
			"metaData" : {
				"idProperty" : -1,
				"totalProperty" : "total",
				"successProperty" : "success",
				"root" : "data",
				"fields" : [],
				"columns" : []
			},
			"total" : 0,
			"data" : [],
			"success" : false,
			"message" : "failure"
		};	
		this.connect(name,function(err,q) {
			if (err) fn('CONNECTION_REFUSED',err); else  {
				var sql2=sql.split('LIMIT')[0];
				q.query(sql2,function(err,rows,fields) {
					if (!err) {
						var total=rows.length;
						q.query(sql,function(err,rows,fields) {
							if (!err) {
								model.success=true;
								model.message="OK";
								model.data=rows;
								model.total=total;
								for (var i=0;i<fields.length;i++) {
									var field=fields[i];
									var typ=getMySQLType(field.type).toLowerCase();
									if (typ=="var_string") typ="string";
									if (typ=="long") typ="int";
									if (typ=="newdecimal") typ="float";
									if (typ=="blob") typ="string";
									if (typ=="tiny") typ="boolean";
									if (typ=="short") typ="int";
									if (typ=="double") typ="float";
									if (field.flags=="16899") model.metaData.idProperty=field.name;
									var o={
										name: field.name,
										type: typ,
										length: field.length
									};
									if (o.type.indexOf("date")>-1) {
										o.dateFormat= 'c';
										o.type="date";
									};
									model.metaData.fields[model.metaData.fields.length]=o;
								};
							} else {
								model.message=err;
							};
							q.end();
							fn(err,model);
						});					
					} else {
						model.message=err;
						q.end();
						fn(err,model);
					}
				});
			}
		});	
	},
	store: function(name,sql,fn) {
		var response={
			"type" : "raw",
			"success" : false,
			"message" : "failure",
			"data" : []
		};
		this.connect(name,function(err,q) {
			if (err) fn('CONNECTION_REFUSED',err); else  {
				q.query(sql,function(err,rows,fields) {
					if (!err) {
						response.success=true;
						response.message="OK";
						response.data=rows;
						response.total=rows.length;
					} else {
						response.message=err;
					};
					q.end();
					fn(err,response);				
				});
			}
		})	
	},
	del: function(name,tb,ndx,cb) {
		var response={
			"type" : "raw",
			"success" : false,
			"message" : "failure",
			"data" : []
		};
		this.connect(name,function(err,q) {
			if (err) fn('CONNECTION_REFUSED',err); else  {
				var sql="";
				if (!ndx.isArray) ndx=[ndx];
				for (var i=0;i<ndx.length;i++) {
					ndx[i]=qstr(ndx[i]);
				};
				// get index
				q.query("show index from "+tb+" where Key_name = 'PRIMARY' ;",function(e,r) {
					if (r.length>0) {
						var x=r[0].Column_name;
						console.log('_____ DELETE');
						var sql="DELETE FROM "+tb+" WHERE "+x+" in ("+ndx.join(',')+")";
						q.query(sql,function(err,rows,fields) {
							q.end();
							cb(err,rows);
						});						
					}
				});
			}
		});
	},
	post: function(name,tb,o,cb) {
		var response={
			"type" : "raw",
			"success" : false,
			"message" : "failure",
			"data" : []
		};
		function isDate(e) {
			try {
				if (typeof e === 'object') {
					if (e.getUTCDay) return true; else return false;
				} else return false;
			}catch(e) {
				return false;
			}
		};
		function ISODateString(d){
			function pad(n){return n<10 ? '0'+n : n}
			return d.getFullYear()+'-'
				+ pad(d.getMonth()+1)+'-'
				+ pad(d.getDate()) +' '
				+ pad(d.getHours())+':'
				+ pad(d.getMinutes())+':'
				+ pad(d.getSeconds())
		};
		this.connect(name,function(err,q) {
			if (err) fn('CONNECTION_REFUSED',err); else  {
				var sql="";
				// get index
				q.query("show index from "+tb+" where Key_name = 'PRIMARY' ;",function(e,r) {
					if (r.length>0) {
						var ndx=r[0].Column_name;
						if (!o[ndx]) {
							console.log('_____ INSERT');
							var fields=[];
							var values=[];
							for (var el in o) {
								fields.push(el);
								if (isDate(o[el])) {
									values.push(qstr(ISODateString(o[el])));
								} else {
									if (typeof o[el] === 'object') values.push(qstr(JSON.stringify(o[el]))); else values.push(qstr(o[el]));
								}
							};
							var sql="INSERT INTO "+tb+" ("+fields.join(',')+") VALUES ("+values.join(',')+")";
							q.query(sql,function(err,rows,fields) {
								q.end();
								cb(err,rows);
							});						
						} else {
							var sql="SELECT * FROM "+tb+" WHERE "+ndx+"="+o[ndx];
							q.query(sql,function(err,rows) {
								if (rows.length==0) {
									console.log('_____ INSERT');
									var fields=[];
									var values=[];								
									for (var el in o) {
										fields.push(el);
										if (isDate(o[el])) {
											values.push(qstr(ISODateString(o[el])));
										} else {
											if (typeof o[el] === 'object') values.push(qstr(JSON.stringify(o[el]))); else values.push(qstr(o[el]));
										}
									};
									var sql="INSERT INTO "+tb+" ("+fields.join(',')+") VALUES ("+values.join(',')+")";
									q.query(sql,function(err,rows,fields) {
										q.end();
										cb(err,rows);
									});								
								} else {
									console.log('_____ UPDATE');								
									var fields=[];
									for (var el in o) {
										if (isDate(o[el])) {
											fields.push(el+'='+qstr(ISODateString(o[el])));
										} else {
											if (typeof o[el] === 'object') fields.push(el+'='+qstr(JSON.stringify(o[el]))); else
											fields.push(el+'='+qstr(o[el]));
										};
									};								
									var sql="UPDATE "+tb+" SET "+fields.join(',')+" WHERE "+ndx+"='"+o[ndx]+"'";
									q.query(sql,function(err,rows,fields) {
										q.end();
										cb(err,rows);
									});									
								}
							});
						}
					} else cb("ERR: No index in table",null);
				});
			}
		});
	}
};