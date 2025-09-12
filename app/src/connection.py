import mysql.connector 

def get_db_connection():
    return mysql.connector.connect(
        host = "localhost",
        user = "root",
        passwd = "root",
        database = "alumni_platform"
    )
