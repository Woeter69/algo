import mysql.connector 
mydb = mysql.connector.connect(host="localhost",user="root",passwd="root")

cur = mydb.cursor()

