const mysql = require('mysql2/promise');
const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const dbConfig = require('./dbConfig.json');
require('dotenv').config();

const dbType = process.env.DB_TYPE || '1'; 

// Cache for storing multiple active database connections and their specific query files
const activeConnections = {};

// Initialize a specific database connection
async function connectDB(connectionName) {
    if (activeConnections[connectionName]) {
        return; // Already connected!
    }

    const config = dbConfig[connectionName]?.[dbType];
    if (!config) {
        throw new Error(`Configuration for connection '${connectionName}' with DB_TYPE '${dbType}' not found.`);
    }

    // Dynamically load the specific query file (e.g., taleeo_lms_queries_1.json)
    let queries = {};
    try {
        queries = require(`./${connectionName}_queries_${dbType}.json`);
    } catch (error) {
        console.error(`⚠️ Could not find query file: ${connectionName}_queries_${dbType}.json!`);
    }

    let dbInstance = null;

    try {
        if (dbType === '2') {
            dbInstance = mysql.createPool(config);
            console.log(`🚀 MySQL Connected for [${connectionName}]`);
        } else if (dbType === '3') {
            dbInstance = new Pool(config);
            console.log(`🚀 PostgreSQL Connected for [${connectionName}]`);
        } else if (dbType === '1') {


            const envVarName = `MONGO_URL_${config.database.toUpperCase()}`;
            const mongoUrl = process.env[envVarName];
            
            if (!mongoUrl) {
                throw new Error(`Environment variable ${envVarName} is not defined in your .env file!`);
            }

            // Connect using the secure, database-specific environment variable
            const mongoClient = new MongoClient(mongoUrl);
            await mongoClient.connect();
            dbInstance = mongoClient.db(config.database);
            
            console.log(`🚀 MongoDB Atlas Connected for [${connectionName}] using ${envVarName}`);
        }

        // Save the instance and its queries into our active cache
        activeConnections[connectionName] = {
            type: dbType,
            db: dbInstance,
            queries: queries
        };

    } catch (err) {
        console.error(`Database connection failed for [${connectionName}]:`, err);
        process.exit(1);
    }
}

// SQL Query Builder
function buildSQLQuery(queries, queryKey, args = {}) {
    const q = queries[queryKey];
    if (!q) throw new Error(`Query key ${queryKey} not found in JSON dictionary`);

    let select = q.columns ? q.columns.join(', ') : '*';
    let sql = `SELECT ${select} FROM ${q.table}`;

    if (q.joins && q.joins.length > 0) {
        q.joins.forEach(j => {
            sql += ` ${j.type || 'INNER'} JOIN ${j.table} ON ${j.on}`;
        });
    }

    let values = [];
    const whereParams = args.where || q.where;
    if (whereParams && Object.keys(whereParams).length > 0) {
        const clauses = Object.keys(whereParams).map(k => {
            values.push(whereParams[k]);
            return dbType === '3' ? `${k} = $${values.length}` : `${k} = ?`; 
        });
        sql += ` WHERE ${clauses.join(' AND ')}`;
    }

    if (q.groupBy && q.groupBy.length > 0) {
        sql += ` GROUP BY ${q.groupBy.join(', ')}`;
    }

    let limit = args.limit || q.maximumcount || 100;
    let offset = args.offset || q.minimum || 0;
    
    sql += ` LIMIT ${limit} OFFSET ${offset}`;

    return { sql, values };
}

// Execute SELECT query
async function executeSelect(connectionName, queryKey, args = {}) {
    const conn = activeConnections[connectionName];
    if (!conn) throw new Error(`Database [${connectionName}] is not connected.`);

    if (conn.type === '2' || conn.type === '3') {
        const { sql, values } = buildSQLQuery(conn.queries, queryKey, args);
        console.log(`[${connectionName}] Executing SQL: ${sql}`);
        
        if (conn.type === '2') {
            const [rows] = await conn.db.execute(sql, values);
            return rows;
        } else {
            const { rows } = await conn.db.query(sql, values);
            return rows;
        }
    } else if (conn.type === '1') {
        // MONGODB LOGIC
        const q = conn.queries[queryKey];
        if (!q) throw new Error(`Query key ${queryKey} not found in MongoDB JSON dictionary`);
        
        const collection = conn.db.collection(q.collection);
        
        // const whereParams = args.where || q.where || {};
        const whereParams = { 
        ...(q.where || {}), 
        ...(args.where || {}) 
    };
        let limit = args.limit || q.maximumcount || 100;
        let skip = args.offset || q.minimum || 0;

        return await collection.find(whereParams).skip(skip).limit(limit).toArray();
    }
}

// Execute INSERT/UPDATE
async function executeWrite(connectionName, sqlOrCollection, data, mongoOperation = 'insertOne') {
    const conn = activeConnections[connectionName];
    if (!conn) throw new Error(`Database [${connectionName}] is not connected.`);

    if (conn.type === '2') {
        const [result] = await conn.db.execute(sqlOrCollection, data);
        return result;
    } else if (conn.type === '3') {
        const result = await conn.db.query(sqlOrCollection, data);
        return result;
    } else if (conn.type === '1') {
        const collection = conn.db.collection(sqlOrCollection);
        // return await collection[mongoOperation](data);
        // 🌟 FIX: Handle update operations that require two arguments (filter, update)
        if (mongoOperation.includes('update') || mongoOperation.includes('replace')) {
            return await collection[mongoOperation](data.filter, data.updateData);
        }

        // Standard logic for insertOne, insertMany, etc.
        return await collection[mongoOperation](data);
    }
}
// Add this below your executeSelect function in config/db.js

// Execute optimized COUNT query
async function executeCount(connectionName, queryKey, args = {}) {
    const conn = activeConnections[connectionName];
    if (!conn) throw new Error(`Database [${connectionName}] is not connected.`);

    if (conn.type === '2' || conn.type === '3') {
        const q = conn.queries[queryKey];
        if (!q) throw new Error(`Query key ${queryKey} not found.`);

        let sql = `SELECT COUNT(*) as totalCount FROM ${q.table}`;
        
        // Add WHERE clauses if they exist
        let values = [];
        const whereParams = args.where || q.where;
        if (whereParams && Object.keys(whereParams).length > 0) {
            const clauses = Object.keys(whereParams).map(k => {
                values.push(whereParams[k]);
                return conn.type === '3' ? `${k} = $${values.length}` : `${k} = ?`; 
            });
            sql += ` WHERE ${clauses.join(' AND ')}`;
        }

        if (conn.type === '2') {
            const [rows] = await conn.db.execute(sql, values);
            return rows[0].totalCount; // MySQL returns count
        } else {
            const { rows } = await conn.db.query(sql, values);
            return parseInt(rows[0].totalcount); // Postgres returns count
        }
    } else if (conn.type === '1') {
        // MONGODB LOGIC (Super fast count operation)
        const q = conn.queries[queryKey];
        const collection = conn.db.collection(q.collection);
        const whereParams = args.where || q.where || {};
        
        return await collection.countDocuments(whereParams);
    }
}

// Execute MongoDB Aggregation or complex joined queries
async function executeAggregate(connectionName, queryKey, args = {}) {
    const conn = activeConnections[connectionName];
    if (!conn) throw new Error(`Database [${connectionName}] is not connected.`);

    if (conn.type === '1') {
        const q = conn.queries[queryKey];
        if (!q) throw new Error(`Query key ${queryKey} not found.`);
        
        const collection = conn.db.collection(q.collection);
        
        // Use the pipeline from JSON, or allow passing a dynamic one via args
        // FIX: Create a shallow copy of the pipeline array to prevent appending 
        // stages to the original JSON dictionary reference.
        let pipeline = [...(args.pipeline || q.pipeline || [])];

        // Apply dynamic filters ($match) if passed in args.where
        if (args.where) {
            pipeline.push({ $match: args.where });
        }

        // Apply Pagination if requested
        if (args.limit) pipeline.push({ $limit: args.limit });
        if (args.offset) pipeline.push({ $skip: args.offset });

        console.log(`[${connectionName}] Executing MongoDB Aggregate on: ${q.collection}`);
        return await collection.aggregate(pipeline).toArray();
    } else {
        // Fallback for SQL: If it's type 2 or 3, just use the standard select
        // since buildSQLQuery already handles JOINs defined in the JSON.
        return await executeSelect(connectionName, queryKey, args);
    }
}
async function searchCourses(connectionName, searchTerm, offset = 0, limit = 20) {
    const conn = activeConnections[connectionName];
    const query = searchTerm ? { 
        $or: [
            { name: { $regex: searchTerm, $options: 'i' } },
            { description: { $regex: searchTerm, $options: 'i' } }
        ] 
    } : {};

    const collection = conn.db.collection('courses');
    
    // 1. Get Total Count for Pagination
    const totalRecords = await collection.countDocuments(query);

    // 2. Fetch Paginated & Joined Data
    const pipeline = [
        { $match: query },
        { $skip: offset },
        { $limit: limit },
        {
            "$lookup": {
                "from": "modules",
                "localField": "id",
                "foreignField": "courseId",
                "as": "moduleDetails"
            }
        },
        {
            "$lookup": {
                "from": "batches",
                "localField": "id",
                "foreignField": "courseId",
                "as": "batchDetails"
            }
        }
    ];

    const results = await collection.aggregate(pipeline).toArray();
    return { totalRecords, courses: results };
}
/**
 * Fetches all courses with their joined modules and batches 
 * using the pre-defined "getCourseFullDetails" pipeline.
 */
async function getFullCurriculum(connectionName, args = {}) {
    // We explicitly use the key "getCourseFullDetails" from your config
    const queryKey = "getCourseFullDetails";
    
    try {
        // Use your existing executeAggregate helper to run the joined pipeline
        const courses = await executeAggregate(connectionName, queryKey, {
            limit: args.limit || 20,
            offset: args.offset || 0,
            where: args.searchTerm ? { 
                name: { $regex: args.searchTerm, $options: 'i' },
                isDeleted: false 
            } : { isDeleted: false }
        });

        // Fetch count for frontend pagination totals
        const conn = activeConnections[connectionName];
        const totalRecords = await conn.db.collection('courses').countDocuments({ isDeleted: false });

        return { totalRecords, courses };
    } catch (error) {
        console.error("Aggregation failed:", error);
        throw error;
    }
}
/**
 * Optimized Search for Courses using aggregation
 * Includes fuzzy matching and relational lookups
 */
async function searchCoursesWithFilters(connectionName, searchTerm, limit = 20) {
    const conn = activeConnections[connectionName];
    if (!conn) throw new Error(`Database [${connectionName}] is not connected.`);

    // Define search pattern
    const searchRegex = { $regex: searchTerm, $options: 'i' };

    const pipeline = [
        { 
            $match: { 
                isDeleted: false,
                $or: [
                    { name: searchRegex },
                    { id: searchRegex },
                    { description: searchRegex }
                ]
            } 
        },
        // {
        //     $lookup: {
        //         from: "modules",
        //         localField: "id",
        //         foreignField: "courseId",
        //         as: "modules"
        //     }
        // },
        {
            $lookup: {
                from: "modules",
                let: { course_id: "$id" }, // Define variable from courses collection
                pipeline: [
                    { 
                        $match: { 
                            $expr: { $eq: ["$courseId", "$$course_id"] },
                            // 🌟 Only include if isDeleted is explicitly false OR missing
                            isDeleted: { $ne: true } 
                        } 
                    },
                    { $sort: { order: 1 } } // Optional: Keep modules in correct sequence
                ],
                as: "modules"
            }
        },
        {
            $lookup: {
                from: "batches",
                localField: "id",
                foreignField: "courseId",
                as: "batches"
            }
        },
        { $limit: parseInt(limit) }
    ];

    const collection = conn.db.collection('courses');
    const courses = await collection.aggregate(pipeline).toArray();
    
    // Return standardized format for frontend counts
    return { totalRecords: courses.length, courses };
}
// Don't forget to export it at the very bottom!
module.exports = { connectDB, executeSelect, executeWrite, executeCount,executeAggregate, getFullCurriculum,searchCourses, 
    activeConnections, // 🌟 MUST BE EXPORTED
    searchCoursesWithFilters
     };
