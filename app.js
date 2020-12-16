const {count} = require('console');
var mysql		= require('mysql');

function resolveAll( object )
{
	var promises	= [];
	var index		= [];

	for( var i in object )
	{
		index.push( i );
		promises.push( object[ i ] );
	}

	return Promise.all( promises ).then
	(
	 	(values)=>
		{
			var obj = {};
			for(var i=0;i<values.length;i++)
			{
				obj[ index[ i ] ] = values [ i ];
			}

			return obj;
		}
	);
}
class DbConnection
{
	constructor(host,user,password,database)
	{
		this.connection = mysql.createConnection({
			host,
			user,
			password,
			database
		});

		this.connection.connect();
	}
	query(sql)
	{
		return new Promise((resolve,reject)=>
		{
			this.connection.query(sql, function (error, result, fields) {
				if( error )
				{
					reject( error );
					return;
				}
				resolve({result: result,fields:fields});
			});
		});
	}
	end()
	{
		this.connection.end();
	}
}

if( process.argv.length !== 7 )
{
	console.error('Usage:\nnnode app.js host user password database');
	//constructor(host,user,password,database)
}
else
{
	let databaseName1 = process.argv[5];
	let databaseName2 = process.argv[6];

	let db1 = new DbConnection(process.argv[2],process.argv[3],process.argv[4], databaseName1 );
	let db2 = new DbConnection(process.argv[2],process.argv[3],process.argv[4], databaseName2 );


    resolveAll({db1: db1.query('SHOW TABLES'),db2: db2.query('SHOW TABLES')}).then((responses)=>{
        let sortF = (a,b)=>a.localeCompare(b);

        let db1Tables = responses.db1.result.map(i=>i['Tables_in_'+databaseName1]);
        let db2Tables = responses.db2.result.map(i=>i['Tables_in_'+databaseName2]);

        db1Tables.sort(sortF);
        db2Tables.sort(sortF);


        let counter1 = 0;
        let counter2 = 0;
        let tableNames= [];

        while(counter1< db1Tables.length || counter2< db2Tables.length )
        {

            if( counter1< db1Tables.length && counter2 < db2Tables.length )
            {
                let result = db1Tables[ counter1].localeCompare( db2Tables[ counter2 ] )

                if( result == 0 )
                {
                    tableNames.push( db1Tables[counter1] );
                    counter2++;
                    counter1++;
                }
                else if( db1Tables[ counter1 ].localeCompare( db2Tables[counter2] ) > 0 )
                {
                    tableNames.push( db2Tables[counter2] );
                    counter2++;
                }
                else
                {
                    tableNames.push( db1Tables[counter1] );
                    counter1++;
                }
            }
            else
            {
                if( counter1 < db1Tables.length )
                {
                    tableNames.push( db1Tables[counter1] );
                    counter1++;
                }
                else
                {

                    tableNames.push( db2Tables[counter2] );
                    counter2++;
                }
            }
        }

        let promises = [];
        tableNames.forEach((tableName)=>{
            promises.push(getRecords(tableName, db1, db2, db1Tables, db2Tables));
        });
        return resolveAll({tableNames: Promise.resolve(tableNames ), value: Promise.all(promises)});
    }).then((responses)=>{
		//console.log(responses);

        responses.tableNames.forEach((tableName,index)=>{
            //console.log( tableName, index );
			//console.log( index );
			//console.log( tableName, responses.value[index], responses.value[index].length );

            if( responses.value[index][0] != responses.value[index][1])
            {
                console.log(tableName+' no son iguales', responses.value[index][0], responses.value[index][1]  );
            }
            //else{
            //    console.log( tableName, 'Same' );
            //}
        });
        return Promise.resolve();
    }).then(()=>{
        db1.end();
        db2.end();
    }).catch((error)=>console.error(error));
}

function getRecords(tableName,database1,database2, tablesDb1, tablesDb2)
{
    let resultPromiseFunc =(result)=>
    {
        if( result.result.length == 0 )
            return Promise.resolve( 0 );

        return Promise.resolve( result.result[0]['count'] );
    };

    let find = (i)=>i==tableName;

    if(tablesDb1.find( find ) && tablesDb2.find( find ))
    {
        return Promise.all([
            database1.query('SELECT count(*) as count FROM `'+tableName+'`;').then( resultPromiseFunc ),
            database2.query('SELECT count(*) as count FROM `'+tableName+'`;').then( resultPromiseFunc ),
        ]);
    }
    else if( tablesDb1.find( find ))
    {
        return Promise.all([
            database1.query('SELECT count(*) as count FROM `'+tableName+'`;').then(resultPromiseFunc),
            Promise.resolve(-1)
       ]);
    }
    else
    {
        return Promise.all([
            Promise.resolve(-1),
            database2.query('SELECT count(*) as count FROM `'+tableName+'`;').then( resultPromiseFunc )
        ])
    }
}
