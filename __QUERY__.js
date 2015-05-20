__QUERY__ = {
	exec: function(o,cb)
	{
		var err=null;
		var response=null;
		var SQL=[];
		function query_fields(q) {
			if (q.indexOf('=')>-1) {
				// =
				if (q.split('=')[1].indexOf('*')>-1) {
					// like
					SQL.push(q.split('=')[0]+' like "'+q.split('=')[1].replace(/\*/g,'%')+'"');
				} else {
					if (q.split('=')[1].indexOf('[')>-1) {
						//in
						SQL.push(q.split('=')[0]+' in ('+q.split('=')[1].split('[')[1].split(']')[0]+')');
					} else {
						SQL.push(q.split('=')[0]+'="'+q.split('=')[1]+'"');
					}
				}
			}
		};
		function querycommander(o) {
			var db=__QUERY__.using('db');			
			var ORDERBY=[];
			var LIMIT=[];
			var cmd=o[1];
			// détection des champs
			if (cmd.indexOf('}')>-1) {
				var fields=cmd.split('{')[1].split('}')[0].split(',');
				for (var i=0;i<fields.length;i++) {
					if (fields[i].indexOf('+')>-1) {
						ORDERBY.push(fields[i]);
						fields[i]=fields[i].split('+')[0];
						
					};
					if (fields[i].indexOf('-')>-1) {
						ORDERBY.push(fields[i]);
						fields[i]=fields[i].split('-')[0];
					};
					if (fields[i].indexOf('=')>-1) {
						fields[i]=fields[i].split('=')[1]+' '+fields[i].split('=')[0];
					};
				};
				fields.join(',');
			} else var fields="*";
			var table=cmd.split('?')[0].split('{')[0].split('.')[0];
			SQL.push('SELECT');
			SQL.push(fields);
			SQL.push('FROM');
			SQL.push(table);
//			SQL.push("join unites on unites.kuni=agents.kuni");
			SQL.push('WHERE');
			
			// détection des fonctions
			
			if (cmd.indexOf('.limit(')>-1) {
				var fcn=cmd.split('.limit(')[1].split(')')[0];
				LIMIT.push(fcn);
			};
			if (cmd.indexOf('.sort(')>-1) {
				var fcn=cmd.split('.sort(')[1].split(')')[0].split(',');
				for (var i=0;i<fcn.length;i++) ORDERBY.push(fcn[i]);
			};
			
			// détection du query
			if (cmd.indexOf('?')==-1) SQL.push('-1'); else {
				var query=cmd.split('?')[1].split('&');
				for (var i=0;i<query.length;i++)
				{
					if (query[i].indexOf('(')==-1) {
						// AND
						if (i>0) SQL.push('AND');
						query_fields(query[i]);
					} else {
						// OR
						var kery=cmd.split('(')[1].split(')')[0].split('||');
						SQL.push('(');
						for (var i=0;i<kery.length;i++) {
							if (i>0) SQL.push('OR');
							query_fields(kery[i]);
						};
						SQL.push(')');
					};
				}
			};
			// order by
			if (ORDERBY.length>0) {
				SQL.push('ORDER BY');
				var order_by=[];
				for (var i=0;i<ORDERBY.length;i++)
				{
					if (ORDERBY[i].indexOf('-')>-1) order_by.push(ORDERBY[i].split('-')[0].split('=')[0]+' DESC');
					else order_by.push(ORDERBY[i].split('+')[0].split('=')[0]);
				};
				SQL.push(order_by.join(', '));
			};
			// limit
			if (LIMIT.length>0) {
				SQL.push('LIMIT '+LIMIT[0]);
			}
			console.log(SQL.join(' '));
			db.model(o[0],SQL.join(' '),cb);
		};
		if (!o.__SQL__) {
			// Pas de params __SQL__ --> Mauvaise réponse
			err={
				msg: "BAD_RESPONSE"
			};
		} else {
			var QUERY=o.__SQL__.split('://');
			// no database selected
			if (QUERY.length<2) {
				err={
					msg: "NO_DATABASE_SELECTED"
				}
			} else querycommander(QUERY);
		};
	}
};

module.exports=__QUERY__;