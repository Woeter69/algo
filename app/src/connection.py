import mysql.connector 
mydb = mysql.connector.connect(host="localhost",user="root",passwd="root",database="alumni_platform")

cur = mydb.cursor()


