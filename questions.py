
import random

def questions(user_qs, count):
    question = {'What is Algo?':['Algo is a platform designed to strengthen the connection between alumni and their institutions. Institutions can use it to maintain communication with their alumni for events like alumni meets, donation drives, career counseling, and more. It also enables current students to connect with their seniors for guidance and mentorship.',
                                'Algo serves as a dedicated platform that bridges the relationship between institutions and their alumni. It helps institutions engage with their alumni through initiatives such as reunions, fundraising, and career support activities. Additionally, the platform provides current students with an opportunity to seek mentorship and advice from their seniors.',
                                'Algo is built to connect alumni with their alma maters, ensuring institutions can easily keep in touch with former students for purposes like alumni gatherings, donation campaigns, and career counseling sessions. At the same time, it empowers current students to reach out to alumni for valuable mentorship and guidance.'],
                'How can I login to Algo?':['To access Algo, go to the login page and enter your username and password. New users must register first by opening the sign-up page and filling in the necessary details such as full name and enrollment number. Once registered, you can log in with your new credentials.',
                                            'Log in to Algo by navigating to the login page and providing your username and password. If you haven’t registered yet, start by visiting the sign-up page and completing the form with details like your full name and enrollment number. After completing registration, use those credentials to sign in.',
                                            'To use Algo, open the login page and enter your username and password. First-time users should create an account by going to the sign-up page and submitting information such as full name and enrollment number. Once your account is created, you can log in with your chosen credentials.' ],

                }

    if user_qs in question:
        print(random.choice(question[user_qs]), end = "\n\n")
    else:
        main(count+1)

def main(count):
        if count == 0:
            user_qs = input("Hey, How can I help you? ")
        else:
            user_qs = input("Sorry, I don't have an answer for that question. Can you please rephrase that, or ask another question? ")
        questions(user_qs, count)

main(count = 0)