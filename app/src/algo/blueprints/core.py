from flask import Blueprint, render_template

bp = Blueprint('core', __name__)

@bp.route('/')
def home():
    """Renders the main landing page."""
    return render_template('home.html')

@bp.route('/about')
def about():
    """Renders the about us page."""
    return render_template('about.html')

@bp.route('/contact', methods=['GET', 'POST'])
def contact():
    """Render the contact page and handle form submission"""
    if request.method == 'POST':
        # Logic to handle contact form submission will be moved here
        flash('Thank you for your message. We will get back to you shortly.', 'success')
        return redirect(url_for('core.contact'))
    return render_template('contact.html')
