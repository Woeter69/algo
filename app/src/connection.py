import mysql.connector 

def get_db_connection():
    return mysql.connector.connect(
        host = "localhost",
        user = "alumni_user",
        passwd = "root",
        database = "alumni_platform"
    )
