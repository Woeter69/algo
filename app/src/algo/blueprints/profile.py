from flask import (
    Blueprint, flash, redirect, render_template, request, session, url_for
)
import datetime
from algo.db import get_db
# from algo.auth.decorators import login_required # This will be used on all routes

bp = Blueprint('profile', __name__, url_prefix='/profile')
